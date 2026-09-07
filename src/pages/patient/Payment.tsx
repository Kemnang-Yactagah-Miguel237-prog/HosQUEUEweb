import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Ticket, Service } from '../../lib/db';

type Step = 'choose' | 'form' | 'processing' | 'success';

export default function Payment() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [provider, setProvider] = useState<'mtn' | 'orange' | 'redirect' | null>(null);
  const [phone, setPhone] = useState('');
  const [confirmedTicket, setConfirmedTicket] = useState<Ticket | null>(null);
  const [campayRef, setCampayRef] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!ticketId) return;

    // Vérification du ticket
    api.tickets.getById(ticketId)
      .then(async tk => {
        if (!tk) {
          navigate('/patient');
          return;
        }

        // Si le ticket est déjà validé
        if (tk.status !== 'pending_payment') {
          setTicket(tk);
          setConfirmedTicket(tk);
          setStep('success');
          const svc = await api.services.getById(tk.serviceId);
          if (svc) setService(svc);
          return;
        }

        setTicket(tk);
        const svc = await api.services.getById(tk.serviceId);
        if (svc) setService(svc);

        // Si on revient d'une redirection Campay avec un statut ou une référence dans l'URL
        const queryRef = searchParams.get('reference') || searchParams.get('campay_ref');
        const queryStatus = searchParams.get('campay_status') || searchParams.get('status');

        if (queryRef) {
          setStep('processing');
          try {
            const res = await api.payments.checkStatus(queryRef);
            if (res.status === 'SUCCESSFUL' && res.ticket) {
              setConfirmedTicket(res.ticket);
              setStep('success');
            } else {
              setStep('choose');
            }
          } catch {
            setStep('choose');
          }
        } else if (queryStatus === 'SUCCESSFUL' || queryStatus === 'completed') {
          const updated = await api.tickets.getById(ticketId);
          if (updated && updated.status !== 'pending_payment') {
            setConfirmedTicket(updated);
            setStep('success');
          }
        }
      })
      .catch(() => {
        navigate('/patient');
      });
  }, [ticketId, searchParams, navigate]);

  // WebSocket listener pour détection instantanée de la confirmation
  useEffect(() => {
    const unsubscribe = subscribeWS((msg) => {
      if (msg.type === 'PAYMENT_CONFIRMED' && msg.payload?.ticket) {
        if (ticket && msg.payload.ticket.id === ticket.id) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setConfirmedTicket(msg.payload.ticket);
          setStep('success');
        }
      }
    });

    return () => {
      unsubscribe();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [ticket]);

  // Redirection vers le portail hébergé Campay
  const handleRedirectToCampay = async () => {
    if (!ticket || !user) return;
    setErrorMessage(null);
    setRedirecting(true);

    try {
      const returnUrl = `${window.location.origin}/patient/payment/${ticket.id}`;
      const res = await api.payments.createLink(ticket.id, returnUrl);

      if (res.link) {
        window.location.href = res.link;
      } else {
        throw new Error('Lien de paiement Campay introuvable');
      }
    } catch (err: any) {
      console.error('Erreur génération lien Campay:', err);
      setErrorMessage(err.message || (lang === 'fr' ? 'Erreur lors de la redirection vers la plateforme de paiement.' : 'Error redirecting to payment gateway.'));
      setRedirecting(false);
    }
  };

  // Paiement direct Push USSD
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || !provider || provider === 'redirect') return;

    setErrorMessage(null);
    setStep('processing');

    try {
      const providerKey = provider === 'mtn' ? 'mtn_momo' : 'orange_money';
      const res = await api.payments.initiate(ticket.id, phone, providerKey);

      setCampayRef(res.reference);
      setUssdCode(res.ussdCode || (provider === 'mtn' ? '*126#' : '#150#'));

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      let attempts = 0;
      const maxAttempts = 60; // 60 * 2.5s = 2.5 minutes max

      pollTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await api.payments.checkStatus(res.reference);

          if (statusRes.status === 'SUCCESSFUL') {
            clearInterval(pollTimerRef.current);
            if (statusRes.ticket) {
              setConfirmedTicket(statusRes.ticket);
            }
            setStep('success');
          } else if (statusRes.status === 'FAILED') {
            clearInterval(pollTimerRef.current);
            setErrorMessage(statusRes.message || (lang === 'fr' ? 'Paiement échoué ou annulé.' : 'Payment failed or cancelled.'));
            setStep('form');
          } else if (attempts >= maxAttempts) {
            clearInterval(pollTimerRef.current);
            setErrorMessage(lang === 'fr' ? 'Délai d\'attente dépassé. Veuillez réessayer.' : 'Payment timeout. Please try again.');
            setStep('form');
          }
        } catch (err: any) {
          console.error('Erreur vérification statut:', err);
        }
      }, 2500);

    } catch (err: any) {
      console.error('Erreur initialisation paiement Campay:', err);
      setErrorMessage(err.message || (lang === 'fr' ? 'Erreur lors de l\'initialisation du paiement.' : 'Error initiating payment.'));
      setStep('form');
    }
  };

  const handleManualCheck = async () => {
    if (!campayRef) return;
    try {
      const statusRes = await api.payments.checkStatus(campayRef);
      if (statusRes.status === 'SUCCESSFUL') {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        if (statusRes.ticket) setConfirmedTicket(statusRes.ticket);
        setStep('success');
      }
    } catch (err) {
      console.error('Erreur vérification manuelle:', err);
    }
  };

  const handleAbandon = async () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (ticket) {
      try {
        await api.tickets.cancel(ticket.id);
      } catch (err) {
        console.error('Failed to cancel ticket', err);
      }
    }
    navigate('/patient');
  };

  if (!ticket || !service) return null;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        {step === 'choose' && (
          <button onClick={handleAbandon} className="p-2 rounded hover:bg-muted transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <h1 className="text-2xl font-serif">{t('paymentTitle')}</h1>
      </div>

      {/* Amount card */}
      <div className="bg-[#1e293b] text-white border border-border rounded-xl p-5 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide font-semibold">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
            <p className="text-sm text-white/80 mt-0.5">{t('paymentAmount')}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-white">{service.bookingFee.toLocaleString()}</p>
            <p className="text-sm text-teal font-semibold">{t('XOF')}</p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {step === 'choose' && (
        <div className="space-y-4">
          {/* Main action: Redirect to Campay portal */}
          <div className="p-4 bg-primary/5 border-2 border-primary/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-primary font-semibold text-sm">
              <span className="text-lg">🔒</span>
              <span>{lang === 'fr' ? 'Paiement Sécurisé Campay' : 'Secure Campay Payment'}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === 'fr'
                ? 'Réglez vos frais de consultation en toute sécurité via MTN Mobile Money ou Orange Money sur le portail sécurisé Campay.'
                : 'Pay your consultation fees securely using MTN Mobile Money or Orange Money on the Campay portal.'}
            </p>
            <button
              onClick={handleRedirectToCampay}
              disabled={redirecting}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl shadow hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {redirecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'fr' ? 'Redirection en cours...' : 'Redirecting...'}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'fr' ? `Payer ${service.bookingFee.toLocaleString()} XOF avec Campay →` : `Pay ${service.bookingFee.toLocaleString()} XOF with Campay →`}</span>
                </>
              )}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-3 text-xs text-muted-foreground uppercase font-semibold">{lang === 'fr' ? 'Ou payer par prompt USSD' : 'Or pay by direct USSD prompt'}</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Alternative direct USSD prompt */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('paymentProvider')}</p>
            <div className="grid grid-cols-2 gap-3">
              {(['mtn', 'orange'] as const).map(p => (
                <button key={p} onClick={() => { setProvider(p); setStep('form'); }}
                  className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 hover:border-primary/50 transition-all ${provider === p ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow ${p === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
                    {p === 'mtn' ? 'MTN' : 'OM'}
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">
                    {p === 'mtn' ? t('paymentMTN') : t('paymentOrange')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAbandon} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors">
            {t('abandonPayment')}
          </button>
        </div>
      )}

      {step === 'form' && provider !== 'redirect' && (
        <form onSubmit={handlePay} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${provider === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
              {provider === 'mtn' ? 'M' : 'O'}
            </div>
            <span className="text-sm font-medium">{provider === 'mtn' ? t('paymentMTN') : t('paymentOrange')}</span>
            <button type="button" onClick={() => setStep('choose')} className="ml-auto text-xs text-primary hover:underline">{t('edit')}</button>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('paymentPhone')}</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-mono text-muted-foreground font-semibold">+237</span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                placeholder="6XX XXX XXX"
                className="w-full pl-14 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed border border-border/50 space-y-1">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              <span>{lang === 'fr' ? 'Notification USSD Mobile Money :' : 'Mobile Money USSD prompt:'}</span>
            </div>
            <p>
              {lang === 'fr'
                ? 'Une notification USSD apparaîtra sur votre téléphone. Composez votre code PIN secret pour confirmer le paiement.'
                : 'A USSD push notification will prompt on your phone. Enter your secret PIN to confirm payment.'}
            </p>
          </div>

          <button type="submit"
            className="w-full py-3 font-semibold text-sm rounded-xl text-white shadow transition-opacity hover:opacity-90"
            style={{ background: provider === 'mtn' ? '#EAB308' : '#F97316' }}>
            {provider === 'mtn' ? t('payWithMTN') : t('payWithOrange')}
          </button>
          <button type="button" onClick={handleAbandon} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors">
            {t('abandonPayment')}
          </button>
        </form>
      )}

      {step === 'processing' && (
        <div className="text-center py-8 space-y-5 bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="relative mx-auto w-16 h-16">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-primary font-mono text-xs font-bold">
              📱
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-foreground text-lg">{t('paymentProcessing')}</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {lang === 'fr'
                ? `En attente de confirmation Mobile Money. Veuillez valider avec votre code PIN secret sur votre mobile.`
                : `Awaiting Mobile Money confirmation. Please approve with your secret PIN on your phone.`}
            </p>
          </div>

          {ussdCode && (
            <div className="bg-muted/60 p-3 rounded-xl text-xs font-mono text-foreground border border-border/60">
              <span className="text-muted-foreground">{lang === 'fr' ? 'Si vous ne recevez pas de prompt :' : 'If prompt does not appear:'} </span>
              <strong className="text-primary">{ussdCode}</strong>
            </div>
          )}

          {campayRef && (
            <p className="text-[11px] font-mono text-muted-foreground">
              Ref: <span className="font-semibold">{campayRef}</span>
            </p>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button onClick={handleManualCheck}
              className="w-full py-2.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors">
              {lang === 'fr' ? 'J\'ai déjà validé sur mon téléphone' : 'I already approved on my phone'}
            </button>
            <button onClick={() => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); setStep('choose'); }}
              className="text-xs text-muted-foreground hover:underline">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {step === 'success' && confirmedTicket && (
        <div className="space-y-4">
          <div className="text-center py-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-4">
              <svg className="text-emerald-600" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-xl font-serif font-semibold text-foreground">{t('paymentSuccess')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('paymentSuccessMsg')}</p>
          </div>

          <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-3 shadow-sm">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{t('ticketNumber')}</p>
              <p className="text-4xl font-mono font-bold text-primary mt-1">{confirmedTicket.number}</p>
            </div>
            <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('service')}</p>
                <p className="font-medium">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('paymentRef')}</p>
                <p className="font-mono text-xs text-primary">{confirmedTicket.paymentRef}</p>
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/patient/queue')}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity shadow">
            {t('viewMyQueue')}
          </button>
        </div>
      )}
    </div>
  );
}
