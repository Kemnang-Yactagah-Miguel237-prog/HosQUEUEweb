import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { getServices, getWaitingTickets, getEstimatedWait, getTicketsByPatient, getServiceById, getQueuePosition, type Service, type Ticket } from '../../lib/db';

function QueueBadge({ count }: { count: number }) {
  const color = count >= 10 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
    : count >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
  return <span className={`font-mono font-semibold text-sm px-2 py-0.5 rounded ${color}`}>{count}</span>;
}

export default function PatientDashboard() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<(Service & { queueLength: number; wait: number })[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');

  const load = () => {
    const svcs = getServices().filter(s => s.active).map(s => {
      const q = getWaitingTickets(s.id).length;
      return { ...s, queueLength: q, wait: getEstimatedWait(q + 1) };
    });
    setServices(svcs);
    if (user) setTickets(getTicketsByPatient(user.id).filter(ticket => ticket.status !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [user]);

  const pending = tickets.find(ticket => ticket.status === 'pending_payment');
  const active = tickets.find(ticket => ticket.status === 'waiting' || ticket.status === 'called');
  const pendingService = pending ? getServiceById(pending.serviceId) : null;
  const activeService = active ? getServiceById(active.serviceId) : null;
  const position = active?.status === 'waiting' ? getQueuePosition(active.id) : 0;
  const filteredServices = services.filter(service => `${service.nameEn} ${service.nameFr}`.toLowerCase().includes(search.toLowerCase()));
  const firstName = user?.name.split(' ')[0] || 'there';

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{lang === 'fr' ? `Bonjour, ${firstName}` : `Good morning, ${firstName}`} <span aria-hidden="true">👋</span></h1>
          <p className="text-sm text-muted-foreground mt-1">{lang === 'fr' ? 'Trouvez un service et évitez la file d’attente.' : 'Find a department and skip the waiting line.'}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-muted-foreground"><span className="text-lg">?</span><span className="text-lg">☾</span></div>
      </section>

      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={lang === 'fr' ? 'Rechercher un service, un médecin...' : 'Search for departments, doctors, or services...'} className="w-full rounded-full border border-border bg-card py-3.5 pl-11 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {pending && pendingService && (
        <section className="rounded-2xl border border-orange-300 bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">▣</div><div><h2 className="font-semibold">{lang === 'fr' ? 'Paiement en attente' : 'Payment Pending'}</h2><p className="text-xs text-muted-foreground">{lang === 'fr' ? pendingService.nameFr : pendingService.nameEn} · {active?.patientName || user?.name}</p></div></div>
            <div className="text-right"><p className="font-semibold">{pendingService.bookingFee.toLocaleString()} {t('XOF')}</p><span className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-1 text-[10px] font-medium text-orange-700">{t('pending_payment')}</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground"><span>{lang === 'fr' ? 'Payez par Mobile Money (MTN/Orange) pour confirmer votre position.' : 'Pay with Mobile Money (MTN/Orange) to confirm your queue position.'}</span><button onClick={() => navigate(`/patient/payment/${pending.id}`)} className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white">{lang === 'fr' ? 'Payer' : 'Pay Now'}</button></div>
        </section>
      )}

      {active && activeService && (
        <section className="rounded-2xl bg-[#252c31] p-5 text-white shadow-lg md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-full bg-white text-xl font-semibold text-[#252c31]">{active.number}</div>
            <div className="min-w-0 flex-1"><span className="rounded bg-teal/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal">• {active.status === 'called' ? t('yourTurn') : t('waiting')}</span><h2 className="mt-2 truncate text-lg font-semibold">{lang === 'fr' ? activeService.nameFr : activeService.nameEn}</h2><p className="text-xs text-white/70">◷ {active.status === 'called' ? t('yourTurnMsg') : `${getEstimatedWait(position)} ${t('minutes')} ${lang === 'fr' ? 'estimées' : 'estimated wait'}`}</p></div>
            <div className="text-right"><p className="text-[10px] text-white/70">{t('peopleAhead')}</p><p className="text-3xl font-semibold">{active.status === 'called' ? 0 : Math.max(position - 1, 0)}</p></div>
            <button onClick={() => navigate('/patient/queue')} className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl md:flex">→</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold"><span className="text-accent">▣</span>{t('myQueue')} ({lang === 'fr' ? 'Ma file' : 'My Queue'})</h2>{active && <button onClick={() => navigate('/patient/queue')} className="rounded-full border border-accent px-4 py-2 text-xs font-semibold text-accent">{t('downloadTicket')}</button>}</div>
        <div className="my-4 border-t border-border" />
        {active ? <div className="grid grid-cols-3 items-center gap-3 text-center text-xs"><div><p className="text-muted-foreground">{lang === 'fr' ? 'En cours' : 'Current Serving'}</p><p className="mt-1 text-lg font-semibold">{active.status === 'called' ? active.number : 'R10'}</p></div><div><div className="h-1 rounded-full bg-muted"><div className="h-1 w-1/2 rounded-full bg-accent" /></div></div><div><p className="text-muted-foreground">{lang === 'fr' ? 'Votre ticket' : 'Your Ticket'}</p><p className="mt-1 text-lg font-semibold text-accent">{active.number}</p></div></div> : <p className="py-4 text-center text-sm text-muted-foreground">{t('noActiveTicket')}</p>}
      </section>

      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">{lang === 'fr' ? 'Services' : 'Departments'}</h2><button onClick={() => document.getElementById('departments')?.scrollIntoView({ behavior: 'smooth' })} className="text-xs font-semibold text-accent">{lang === 'fr' ? 'Voir tout' : 'See all'}</button></div><div id="departments" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{filteredServices.map((service, index) => <button key={service.id} onClick={() => navigate(`/patient/booking/${service.id}`)} className="rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${index % 2 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-accent'}`}>✚</div><p className="text-sm font-semibold">{lang === 'fr' ? service.nameFr : service.nameEn}</p><p className="mt-1 text-xs text-muted-foreground">{service.queueLength} {t('inQueue')} · {service.wait} {t('minutes')}</p></button>)}</div></section>
    </div>
  );
}
