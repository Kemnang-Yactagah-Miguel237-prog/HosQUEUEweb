import { useState, useEffect } from 'react';
import { getServices, getCalledTicket, getTodayTickets, type Service, type Ticket } from '../lib/db';

interface ServiceDisplay { service: Service; called: Ticket | null; servedToday: number; waitingCount: number; }

export default function WaitingRoom() {
  const [rows, setRows] = useState<ServiceDisplay[]>([]);
  const [time, setTime] = useState(new Date());
  const [lang, setLang] = useState<'fr' | 'en'>(() => (localStorage.getItem('hq_lang') as 'fr' | 'en') || 'fr');

  const load = () => {
    const services = getServices().filter(s => s.active);
    const data = services.map(s => {
      const called = getCalledTicket(s.id) ?? null;
      const today = getTodayTickets(s.id);
      const servedToday = today.filter(t => t.status === 'served').length;
      const waitingCount = today.filter(t => t.status === 'waiting').length;
      return { service: s, called, servedToday, waitingCount };
    });
    setRows(data);
    setTime(new Date());
  };

  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, []);

  const activeCalls = rows.filter(r => r.called);

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="6" fill="#00A693"/>
            <rect x="18" y="8" width="4" height="24" rx="2" fill="white"/>
            <rect x="8" y="18" width="24" height="4" rx="2" fill="white"/>
            <circle cx="20" cy="20" r="6" stroke="white" strokeWidth="2" fill="none" opacity="0.4"/>
          </svg>
          <div>
            <div className="text-xl" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Hos<span style={{ color: '#00A693' }}>QUEUE</span>
            </div>
            <div className="text-[10px] font-mono tracking-widest uppercase opacity-50">Queue Management</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
            className="px-2.5 py-1 text-xs font-mono border border-white/20 rounded hover:bg-white/10 transition-colors">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold tracking-tight">{time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="text-xs text-white/50 font-mono">{time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-hidden">
        {activeCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <p className="text-3xl font-serif opacity-40">{lang === 'fr' ? 'En attente d\'appel' : 'Awaiting call'}</p>
              <p className="text-sm text-white/30 mt-2">{lang === 'fr' ? 'Les appels s\'afficheront ici en temps réel.' : 'Calls will appear here in real time.'}</p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 h-full ${activeCalls.length === 1 ? 'grid-cols-1' : activeCalls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {activeCalls.map(({ service: s, called }) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
                {/* Accent glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-widest text-white/50">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                  <div className="w-8 h-0.5 bg-teal-400 mx-auto" />
                </div>

                <div className="relative z-10">
                  <p className="text-8xl font-mono font-bold text-teal-400 leading-none tracking-tight animate-pulse">
                    {called!.number}
                  </p>
                </div>

                <div className="relative z-10 space-y-1">
                  <p className="text-2xl font-semibold text-white">{called!.patientName}</p>
                  <p className="text-sm text-white/50 font-mono">
                    {lang === 'fr' ? 'Appelé à' : 'Called at'} {called!.calledAt ? new Date(called!.calledAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>

                <div className="relative z-10 px-4 py-2 bg-teal-500/20 border border-teal-500/30 rounded-full">
                  <p className="text-teal-300 text-sm font-semibold">
                    {lang === 'fr' ? '→ Présentez-vous au guichet' : '→ Please proceed to the window'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service status bar */}
        {rows.length > 0 && (
          <div className="mt-8 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, 1fr)` }}>
            {rows.map(({ service: s, servedToday, waitingCount }) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 font-medium">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                  <p className="text-sm font-semibold mt-0.5 text-white">{waitingCount} {lang === 'fr' ? 'en attente' : 'waiting'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">{lang === 'fr' ? 'Servis' : 'Served'}</p>
                  <p className="text-lg font-mono font-bold text-teal-400">{servedToday}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-8 py-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/20">
        <span>HosQUEUE · {lang === 'fr' ? 'Salle d\'attente' : 'Waiting Room'}</span>
        <span>{lang === 'fr' ? 'Mise à jour toutes les 4s' : 'Updates every 4s'}</span>
      </footer>
    </div>
  );
}
