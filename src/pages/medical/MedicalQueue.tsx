import { useState, useEffect } from 'react';
import { useLang, useAuth } from '../../lib/store';
import { getWaitingTickets, getCalledTicket, callNextPatient, markServed, markSkipped, getServiceById, createNotification, getTodayTickets, type Ticket } from '../../lib/db';

function PatientRow({ ticket, position }: { ticket: Ticket; position: number }) {
  const { lang } = useLang();
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold text-muted-foreground shrink-0">{position}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{ticket.patientName}</p>
        <p className="text-xs text-muted-foreground font-mono">{new Date(ticket.createdAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <span className="font-mono font-bold text-primary">{ticket.number}</span>
    </div>
  );
}

export default function MedicalQueue() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [waiting, setWaiting] = useState<Ticket[]>([]);
  const [called, setCalled] = useState<Ticket | null>(null);
  const [servedCount, setServedCount] = useState(0);

  const serviceId = user?.serviceId;
  const service = serviceId ? getServiceById(serviceId) : null;

  const load = () => {
    if (!serviceId) return;
    setWaiting(getWaitingTickets(serviceId));
    setCalled(getCalledTicket(serviceId) ?? null);
    const today = getTodayTickets(serviceId);
    setServedCount(today.filter(tk => tk.status === 'served').length);
  };

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [serviceId]);

  const handleCallNext = () => {
    if (!serviceId) return;
    const ticket = callNextPatient(serviceId);
    if (ticket) {
      createNotification(ticket.patientId,
        `C'est votre tour ! Présentez-vous au guichet de ${service?.nameFr}.`,
        `It's your turn! Please proceed to the ${service?.nameEn} window.`,
        'your_turn'
      );
    }
    load();
  };

  const handleServed = () => {
    if (!called) return;
    markServed(called.id);
    load();
  };

  const handleSkipped = () => {
    if (!called) return;
    markSkipped(called.id);
    load();
  };

  if (!service) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">{lang === 'fr' ? 'Aucun service assigné à votre compte.' : 'No service assigned to your account.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif">{t('queue')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right bg-card border border-border rounded px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('servedToday')}</p>
            <p className="text-xl font-mono font-bold text-emerald-600">{servedCount}</p>
          </div>
          <div className="text-right bg-card border border-border rounded px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('waitingCount')}</p>
            <p className="text-xl font-mono font-bold text-primary">{waiting.length}</p>
          </div>
        </div>
      </div>

      {/* Current patient */}
      {called ? (
        <div className="bg-card border-2 border-primary rounded overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center justify-between">
            <span className="text-primary-foreground font-semibold text-sm">{t('currentPatient')}</span>
            <span className="text-primary-foreground/70 font-mono text-xs">
              {called.calledAt ? new Date(called.calledAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="text-primary" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{called.patientName}</p>
              <p className="font-mono text-primary text-xl font-bold">{called.number}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSkipped}
                className="px-4 py-2 text-sm font-semibold border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors">
                {t('markSkipped')}
              </button>
              <button onClick={handleServed}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                {t('markServed')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={handleCallNext} disabled={waiting.length === 0}
          className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded text-base hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          {t('callNext')}
        </button>
      )}

      {/* Waiting list */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'File d\'attente' : 'Queue'}</h2>
          <span className="text-xs font-mono text-muted-foreground">{waiting.length} {t('waitingCount')}</span>
        </div>
        {waiting.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <svg className="mx-auto mb-2 opacity-30" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <p className="text-sm">{t('queueEmpty')}</p>
          </div>
        ) : (
          <div>{waiting.map((tk, i) => <PatientRow key={tk.id} ticket={tk} position={i + 1} />)}</div>
        )}
      </div>
    </div>
  );
}
