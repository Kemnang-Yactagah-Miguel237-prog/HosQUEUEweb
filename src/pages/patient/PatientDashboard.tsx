import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Service, Ticket } from '../../lib/db';

export default function PatientDashboard() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<(Service & { queueLength: number; wait: number })[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');
  const [positions, setPositions] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const [allServices, allTickets] = await Promise.all([
        api.services.getAll(),
        api.tickets.getAll()
      ]);

      const activeServices = allServices.filter(s => s.active);

      const enhancedServices = activeServices.map(s => {
        const queue = allTickets.filter(t => t.serviceId === s.id && t.status === 'waiting');
        const qLength = queue.length;
        return {
          ...s,
          queueLength: qLength,
          wait: Math.max(0, (qLength + 1) * 10)
        };
      });

      setServices(enhancedServices);

      if (user) {
        const patientTickets = allTickets
          .filter(tk => tk.patientId === user.id && tk.status !== 'cancelled')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTickets(patientTickets);

        // Fetch queue positions for active tickets
        for (const tk of patientTickets) {
          if (tk.status === 'waiting') {
            api.tickets.getPosition(tk.id)
              .then(res => setPositions(prev => ({ ...prev, [tk.id]: res.position })))
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('Failed to load patient dashboard data', err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeWS((msg) => {
      if (['TICKET_CREATED', 'TICKET_CALLED', 'TICKET_SERVED', 'TICKET_SKIPPED', 'PAYMENT_CONFIRMED', 'QUEUE_UPDATED'].includes(msg.type)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const pending = tickets.find(ticket => ticket.status === 'pending_payment');
  const active = tickets.find(ticket => ticket.status === 'waiting' || ticket.status === 'called');
  const pendingService = pending ? services.find(s => s.id === pending.serviceId) : null;
  const activeService = active ? services.find(s => s.id === active.serviceId) : null;
  const position = active ? (positions[active.id] || 0) : 0;
  const filteredServices = services.filter(service =>
    `${service.nameEn} ${service.nameFr}`.toLowerCase().includes(search.toLowerCase())
  );
  const firstName = user?.name ? user.name.split(' ')[0] : 'Patient';

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {lang === 'fr' ? `Bonjour, ${firstName}` : `Good morning, ${firstName}`} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'fr' ? 'Trouvez un service et évitez la file d’attente.' : 'Find a department and skip the waiting line.'}
          </p>
        </div>
      </section>

      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={lang === 'fr' ? 'Rechercher un service, un médecin...' : 'Search for departments, doctors, or services...'}
          className="w-full rounded-full border border-border bg-card py-3.5 pl-11 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {pending && pendingService && (
        <section className="rounded-2xl border border-orange-300 bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold">💳</div>
              <div>
                <h2 className="font-semibold">{lang === 'fr' ? 'Paiement en attente' : 'Payment Pending'}</h2>
                <p className="text-xs text-muted-foreground">
                  {lang === 'fr' ? pendingService.nameFr : pendingService.nameEn} · {pending.patientName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">{pendingService.bookingFee.toLocaleString()} {t('XOF')}</p>
              <span className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-1 text-[10px] font-medium text-orange-700">
                {t('pending_payment')}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            <span>{lang === 'fr' ? 'Payez par Mobile Money (Orange / MTN MoMo) pour valider votre ticket.' : 'Pay with Mobile Money (Orange / MTN MoMo) to confirm your queue position.'}</span>
            <button
              onClick={() => navigate(`/patient/payment/${pending.id}`)}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {lang === 'fr' ? 'Payer maintenant' : 'Pay Now'}
            </button>
          </div>
        </section>
      )}

      {active && activeService && (
        <section className="rounded-2xl bg-[#1e293b] text-white p-5 shadow-lg md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-mono font-bold text-primary-foreground shadow">
              {active.number}
            </div>
            <div className="min-w-0 flex-1">
              <span className="rounded bg-teal/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal">
                • {active.status === 'called' ? t('yourTurn') : t('waiting')}
              </span>
              <h2 className="mt-2 truncate text-lg font-semibold">
                {lang === 'fr' ? activeService.nameFr : activeService.nameEn}
              </h2>
              <p className="text-xs text-white/70">
                ⏱ {active.status === 'called' ? t('yourTurnMsg') : `${Math.max(0, position * 10)} ${t('minutes')} ${lang === 'fr' ? 'estimées' : 'estimated wait'}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/70">{t('peopleAhead')}</p>
              <p className="text-3xl font-semibold font-mono">{active.status === 'called' ? 0 : Math.max(position - 1, 0)}</p>
            </div>
            <button
              onClick={() => navigate('/patient/queue')}
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20 transition-colors md:flex"
            >
              →
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="text-primary">🎟️</span> {t('myQueue')}
          </h2>
          {active && (
            <button onClick={() => navigate('/patient/queue')} className="rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors">
              {t('downloadTicket')}
            </button>
          )}
        </div>
        <div className="my-4 border-t border-border" />
        {active ? (
          <div className="grid grid-cols-3 items-center gap-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">{lang === 'fr' ? 'Statut du ticket' : 'Status'}</p>
              <p className="mt-1 text-lg font-semibold capitalize font-mono text-primary">{active.status === 'called' ? t('yourTurn') : t('waiting')}</p>
            </div>
            <div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${active.status === 'called' ? 'w-full bg-emerald-500' : 'w-1/2 bg-primary animate-pulse'}`} />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">{lang === 'fr' ? 'Votre ticket' : 'Your Ticket'}</p>
              <p className="mt-1 text-lg font-semibold text-primary font-mono">{active.number}</p>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('noActiveTicket')}</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{lang === 'fr' ? 'Services Hospitaliers' : 'Departments'}</h2>
        </div>
        <div id="departments" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredServices.map((service) => (
            <button
              key={service.id}
              onClick={() => navigate(`/patient/booking/${service.id}`)}
              className="rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                ✚
              </div>
              <p className="text-sm font-semibold text-foreground">{lang === 'fr' ? service.nameFr : service.nameEn}</p>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                {service.queueLength} {t('inQueue')} · ~{service.wait} {t('minutes')}
              </p>
              <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-xs">
                <span className="font-semibold text-primary font-mono">{service.bookingFee.toLocaleString()} {t('XOF')}</span>
                <span className="text-xs text-muted-foreground">Réserver →</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
