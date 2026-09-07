import { useState, useEffect, useCallback } from 'react';
import { useLang, useAuth } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Ticket, Service } from '../../lib/db';

function PatientRow({ ticket, position }: { ticket: Ticket; position: number }) {
  const { lang } = useLang();
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold text-muted-foreground shrink-0">{position}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{ticket.patientName}</p>
        <p className="text-xs text-muted-foreground font-mono">{new Date(ticket.createdAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <span className="font-mono font-bold text-primary text-base">{ticket.number}</span>
    </div>
  );
}

export default function MedicalQueue() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [waiting, setWaiting] = useState<Ticket[]>([]);
  const [called, setCalled] = useState<Ticket | null>(null);
  const [servedCount, setServedCount] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const serviceId = user?.serviceId;

  const loadData = useCallback(async () => {
    if (!serviceId) return;
    try {
      const [svc, allTickets] = await Promise.all([
        api.services.getById(serviceId),
        api.tickets.getAll({ serviceId })
      ]);

      setService(svc);

      const waitingTickets = allTickets
        .filter(t => t.status === 'waiting')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setWaiting(waitingTickets);

      const calledTicket = allTickets.find(t => t.status === 'called') || null;
      setCalled(calledTicket);

      const todayStr = new Date().toDateString();
      const servedToday = allTickets.filter(t => t.status === 'served' && new Date(t.createdAt).toDateString() === todayStr).length;
      setServedCount(servedToday);
    } catch (err) {
      console.error('Failed to load medical queue', err);
    }
  }, [serviceId]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeWS((msg) => {
      if (['TICKET_CREATED', 'TICKET_CALLED', 'TICKET_SERVED', 'TICKET_SKIPPED', 'PAYMENT_CONFIRMED', 'QUEUE_UPDATED'].includes(msg.type)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const handleCallNext = async () => {
    if (!serviceId || loadingAction) return;
    const waitingRoomWindow = window.open('/waiting-room', '_blank');
    setLoadingAction(true);
    try {
      await api.tickets.callNext(serviceId);
      await loadData();
    } catch (err: any) {
      console.error('Error calling next patient', err);
      waitingRoomWindow?.close();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleServed = async () => {
    if (!called || loadingAction) return;
    setLoadingAction(true);
    try {
      await api.tickets.serve(called.id);
      await loadData();
    } catch (err) {
      console.error('Error serving patient', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSkipped = async () => {
    if (!called || loadingAction) return;
    setLoadingAction(true);
    try {
      await api.tickets.skip(called.id);
      await loadData();
    } catch (err) {
      console.error('Error skipping patient', err);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!service) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl p-8">
        <p className="text-sm">{lang === 'fr' ? 'Aucun service assigné à votre compte ou chargement...' : 'No service assigned to your account or loading...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold">{t('queue')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right bg-card border border-border rounded-xl px-4 py-2.5 shadow-xs">
            <p className="text-xs text-muted-foreground">{t('servedToday')}</p>
            <p className="text-xl font-mono font-bold text-emerald-600">{servedCount}</p>
          </div>
          <div className="text-right bg-card border border-border rounded-xl px-4 py-2.5 shadow-xs">
            <p className="text-xs text-muted-foreground">{t('waitingCount')}</p>
            <p className="text-xl font-mono font-bold text-primary">{waiting.length}</p>
          </div>
        </div>
      </div>

      {/* Current patient */}
      {called ? (
        <div className="bg-card border-2 border-primary rounded-2xl overflow-hidden shadow-md">
          <div className="bg-primary px-5 py-3 flex items-center justify-between">
            <span className="text-primary-foreground font-semibold text-sm">{t('currentPatient')}</span>
            <span className="text-primary-foreground/80 font-mono text-xs">
              {called.calledAt ? new Date(called.calledAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div className="p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="text-primary" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-semibold text-lg text-foreground">{called.patientName}</p>
              <p className="font-mono text-primary text-2xl font-bold">{called.number}</p>
            </div>
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleSkipped}
                disabled={loadingAction}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors disabled:opacity-50"
              >
                {t('markSkipped')}
              </button>
              <button
                onClick={handleServed}
                disabled={loadingAction}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow disabled:opacity-50"
              >
                {t('markServed')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleCallNext}
          disabled={waiting.length === 0 || loadingAction}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl text-base hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {loadingAction ? t('loading') : t('callNext')}
        </button>
      )}

      {/* Waiting list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'File d\'attente' : 'Queue'}</h2>
          <span className="text-xs font-mono font-semibold text-primary">{waiting.length} {t('waitingCount')}</span>
        </div>
        {waiting.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <svg className="mx-auto mb-2 opacity-30" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <p className="text-sm font-medium">{t('queueEmpty')}</p>
          </div>
        ) : (
          <div>{waiting.map((tk, i) => <PatientRow key={tk.id} ticket={tk} position={i + 1} />)}</div>
        )}
      </div>
    </div>
  );
}
