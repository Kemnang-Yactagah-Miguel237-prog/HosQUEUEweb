import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Ticket, Service } from '../../lib/db';

type Step = 'choose' | 'form' | 'processing' | 'success';

export default function Payment() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [provider, setProvider] = useState<'mtn' | 'orange' | null>(null);
  const [phone, setPhone] = useState('');
  const [confirmedTicket, setConfirmedTicket] = useState<Ticket | null>(null);
  const [campayRef, setCampayRef] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!ticketId) return;
    api.tickets.getById(ticketId)
      .then(tk => {
        if (!tk || tk.status !== 'pending_payment') {
          navigate('/patient');
          return;
        }
        setTicket(tk);
        return api.services.getById(tk.serviceId);
      })
      .then(svc => {
        if (svc) setService(svc);
      })
      .catch(() => {
        navigate('/patient');
      });
  }, [ticketId, navigate]);

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

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || !provider) return;

    setErrorMessage(null);
    setStep('processing');

    try {
      const providerKey = provider === 'mtn' ? 'mtn_momo' : 'orange_money';
      const res = await api.payments.initiate(ticket.id, phone, providerKey);

      setCampayRef(res.reference);
      setUssdCode(res.ussdCode || (provider === 'mtn' ? '*126#' : '#150#'));

      // Démarrage du polling du statut de la transaction Campay
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
      <div className="bg-[#1e293b] text-white border border-border rounded-xl p-5 flex items-center justify-between shadow">
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide font-semibold">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
          <p className="text-sm text-white/80 mt-0.5">{t('paymentAmount')}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white">{service.bookingFee.toLocaleString()}</p>
          <p className="text-sm text-teal font-semibold">{t('XOF')}</p>
        </div>
      </div>

      {step === 'choose' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('paymentProvider')}</p>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">Via Campay</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['mtn', 'orange'] as const).map(p => (
              <button key={p} onClick={() => { setProvider(p); setStep('form'); }}
                className={`p-5 border-2 rounded-xl flex flex-col items-center gap-3 hover:border-primary/50 transition-all ${provider === p ? 'border-primary' : 'border-border'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow ${p === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
                  {p === 'mtn' ? 'MTN' : 'OM'}
                </div>
                <span className="text-sm font-semibold text-center leading-tight">
                  {p === 'mtn' ? t('paymentMTN') : t('paymentOrange')}
                </span>
              </button>
            ))}
          </div>
          <button onClick={handleAbandon} className="w-full mt-2 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors">
            {t('abandonPayment')}
          </button>
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handlePay} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${provider === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
              {provider === 'mtn' ? 'M' : 'O'}
            </div>
            <span className="text-sm font-medium">{provider === 'mtn' ? t('paymentMTN') : t('paymentOrange')}</span>
            <button type="button" onClick={() => setStep('choose')} className="ml-auto text-xs text-primary hover:underline">{t('edit')}</button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{errorMessage}</span>
            </div>
          )}

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
              <span>{lang === 'fr' ? 'Procédure Campay Mobile Money :' : 'Campay Mobile Money process:'}</span>
            </div>
            <p>
              {lang === 'fr'
                ? 'Une notification USSD apparaîtra automatiquement sur votre téléphone. Composez votre code PIN secret Mobile Money pour valider le paiement.'
                : 'A USSD push notification will automatically prompt on your phone. Enter your secret PIN to confirm.'}
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
                ? `Une demande de débit a été envoyée au +237 ${phone}. Veuillez déverrouiller votre mobile et valider avec votre code secret.`
                : `A payment request has been sent to +237 ${phone}. Please approve the prompt on your phone.`}
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
              className="w-full py-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-xl transition-colors">
              {lang === 'fr' ? 'J\'ai déjà validé sur mon téléphone' : 'I already approved on my phone'}
            </button>
            <button onClick={() => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); setStep('form'); }}
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
