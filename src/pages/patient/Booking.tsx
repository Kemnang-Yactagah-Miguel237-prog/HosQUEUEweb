import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { api } from '../../lib/api';
import type { Service } from '../../lib/db';

export default function Booking() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [queueLen, setQueueLen] = useState(0);
  const [hasPending, setHasPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceId) return;

    api.services.getById(serviceId)
      .then(svc => {
        setService(svc);
      })
      .catch(() => {
        navigate('/patient');
      });

    api.tickets.getAll({ serviceId, status: 'waiting' })
      .then(tks => setQueueLen(tks.length))
      .catch(() => {});

    if (user) {
      api.tickets.getAll({ patientId: user.id })
        .then(tks => {
          const pending = tks.find(tk => tk.serviceId === serviceId && tk.status === 'pending_payment');
          if (pending) setHasPending(pending.id);
        })
        .catch(() => {});
    }
  }, [serviceId, user, navigate]);

  const handleBook = async () => {
    if (!service || !user) return;
    setLoading(true);
    try {
      const ticket = await api.tickets.create(service.id);
      navigate(`/patient/payment/${ticket.id}`);
    } catch (err: any) {
      console.error('Failed to create ticket', err);
    } finally {
      setLoading(false);
    }
  };

  if (!service) return null;

  const wait = Math.max(0, (queueLen + 1) * 10);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patient')} className="p-2 rounded hover:bg-muted transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-2xl font-serif">{t('bookAppointment')}</h1>
      </div>

      {hasPending && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-4 flex items-start gap-3">
          <svg className="shrink-0 text-amber-600 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t('pendingPaymentMsg')}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => navigate(`/patient/payment/${hasPending}`)}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700">
                {t('resumePayment')}
              </button>
              <button onClick={() => navigate('/patient')}
                className="px-3 py-1.5 border border-amber-300 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded hover:bg-amber-100 dark:hover:bg-amber-900">
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasPending && (
        <div className="bg-card border border-border rounded overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-navy/5 dark:bg-white/5">
            <h2 className="text-lg font-semibold">{lang === 'fr' ? service.nameFr : service.nameEn}</h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">{t('inQueue')}</p>
                <p className="text-3xl font-mono font-bold text-foreground">{queueLen}</p>
              </div>
              <div className="bg-muted rounded p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">{t('estimatedWait')}</p>
                <p className="text-3xl font-mono font-bold text-primary">{wait}<span className="text-sm text-muted-foreground ml-1">{t('minutes')}</span></p>
              </div>
            </div>

            <div className="border border-border rounded p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{t('bookingFee')}</p>
                <p className="text-2xl font-mono font-bold text-foreground mt-1">{service.bookingFee.toLocaleString()} <span className="text-sm text-muted-foreground">{t('XOF')}</span></p>
              </div>
              <svg className="text-primary opacity-60" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === 'fr'
                ? 'En cliquant sur "Passer au paiement", un ticket sera créé avec le statut "En attente de paiement". Votre position en file ne sera confirmée qu\'après le paiement.'
                : 'By clicking "Proceed to payment", a ticket will be created with status "Pending payment". Your queue position will only be confirmed after payment.'}
            </p>
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button onClick={() => navigate('/patient')} className="flex-1 py-2.5 border border-border rounded text-sm font-medium hover:bg-muted transition-colors">
              {t('cancel')}
            </button>
            <button
              onClick={handleBook}
              disabled={loading}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? t('loading') : t('proceedToPayment')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
