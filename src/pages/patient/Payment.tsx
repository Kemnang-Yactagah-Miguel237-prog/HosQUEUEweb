import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { getTicketById, getServiceById, confirmPayment, updateTicket, createNotification, type Ticket, type Service } from '../../lib/db';

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

  useEffect(() => {
    if (!ticketId) return;
    const tk = getTicketById(ticketId);
    if (!tk || tk.status !== 'pending_payment') { navigate('/patient'); return; }
    setTicket(tk);
    const svc = getServiceById(tk.serviceId);
    if (svc) setService(svc);
  }, [ticketId]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    await new Promise(r => setTimeout(r, 2200));
    if (!ticket || !user) return;
    const confirmed = confirmPayment(ticket.id);
    if (!confirmed) return;
    createNotification(user.id,
      `Paiement confirmé pour ${service?.nameFr}. Votre ticket: ${ticket.number}`,
      `Payment confirmed for ${service?.nameEn}. Your ticket: ${ticket.number}`,
      'payment_confirmed'
    );
    setConfirmedTicket(confirmed);
    setStep('success');
  };

  const handleAbandon = () => {
    if (ticket) updateTicket(ticket.id, { status: 'cancelled' });
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
      <div className="bg-navy dark:bg-card border border-border rounded p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/60 dark:text-muted-foreground uppercase tracking-wide font-semibold">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
          <p className="text-sm text-white/70 dark:text-muted-foreground mt-0.5">{t('paymentAmount')}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white dark:text-foreground">{service.bookingFee.toLocaleString()}</p>
          <p className="text-sm text-teal font-semibold">{t('XOF')}</p>
        </div>
      </div>

      {step === 'choose' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('paymentProvider')}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['mtn', 'orange'] as const).map(p => (
              <button key={p} onClick={() => { setProvider(p); setStep('form'); }}
                className={`p-5 border-2 rounded flex flex-col items-center gap-3 hover:border-primary/50 transition-all ${provider === p ? 'border-primary' : 'border-border'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${p === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
                  {p === 'mtn' ? 'M' : 'O'}
                </div>
                <span className="text-sm font-semibold text-center leading-tight">
                  {p === 'mtn' ? t('paymentMTN') : t('paymentOrange')}
                </span>
              </button>
            ))}
          </div>
          <button onClick={handleAbandon} className="w-full mt-2 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted transition-colors">
            {t('abandonPayment')}
          </button>
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handlePay} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${provider === 'mtn' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
              {provider === 'mtn' ? 'M' : 'O'}
            </div>
            <span className="text-sm font-medium">{provider === 'mtn' ? t('paymentMTN') : t('paymentOrange')}</span>
            <button type="button" onClick={() => setStep('choose')} className="ml-auto text-xs text-primary hover:underline">{t('edit')}</button>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('paymentPhone')}</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
              placeholder={provider === 'mtn' ? '+224 6XX XXX XXX' : '+224 5XX XXX XXX'}
              className="w-full px-3 py-2.5 bg-card border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="bg-muted/50 rounded p-3 text-xs text-muted-foreground leading-relaxed">
            {lang === 'fr'
              ? 'Vous allez recevoir une demande de confirmation sur votre téléphone. Validez le paiement dans votre application Mobile Money.'
              : 'You will receive a confirmation request on your phone. Confirm the payment in your Mobile Money app.'}
          </div>

          <button type="submit"
            className="w-full py-3 font-semibold text-sm rounded text-white transition-opacity hover:opacity-90"
            style={{ background: provider === 'mtn' ? '#EAB308' : '#F97316' }}>
            {provider === 'mtn' ? t('payWithMTN') : t('payWithOrange')}
          </button>
          <button type="button" onClick={handleAbandon} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted transition-colors">
            {t('abandonPayment')}
          </button>
        </form>
      )}

      {step === 'processing' && (
        <div className="text-center py-12 space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium">{t('paymentProcessing')}</p>
          <p className="text-xs text-muted-foreground">{lang === 'fr' ? 'Veuillez patienter...' : 'Please wait...'}</p>
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

          <div className="bg-card border-2 border-primary/30 rounded p-5 space-y-3">
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
                <p className="font-mono text-xs">{confirmedTicket.paymentRef}</p>
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/patient/queue')}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded hover:opacity-90 transition-opacity">
            {t('viewMyQueue')}
          </button>
        </div>
      )}
    </div>
  );
}
