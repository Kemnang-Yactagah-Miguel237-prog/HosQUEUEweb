import { useState, useEffect, useCallback } from 'react';
import { api, subscribeWS } from '../lib/api';
import type { Service, Ticket } from '../lib/db';

interface ServiceDisplay { service: Service; called: Ticket | null; servedToday: number; waitingCount: number; }

export default function WaitingRoom() {
  const [rows, setRows] = useState<ServiceDisplay[]>([]);
  const [time, setTime] = useState(new Date());
  const [lang, setLang] = useState<'fr' | 'en'>(() => (localStorage.getItem('hq_lang') as 'fr' | 'en') || 'fr');

  const playChime = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // AudioContext might be blocked until user gesture
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [services, tickets] = await Promise.all([
        api.services.getAll(),
        api.tickets.getAll()
      ]);

      const activeServices = services.filter(s => s.active);
      const todayStr = new Date().toDateString();

      const data = activeServices.map(s => {
        const called = tickets.find(t => t.serviceId === s.id && t.status === 'called') || null;
        const svcToday = tickets.filter(t => t.serviceId === s.id && new Date(t.createdAt).toDateString() === todayStr);
        const servedToday = svcToday.filter(t => t.status === 'served').length;
        const waitingCount = tickets.filter(t => t.serviceId === s.id && t.status === 'waiting').length;
        return { service: s, called, servedToday, waitingCount };
      });

      setRows(data);
      setTime(new Date());
    } catch (err) {
      console.error('Failed to load waiting room data', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setTime(new Date()), 1000);

    const unsubscribe = subscribeWS((msg) => {
      if (['TICKET_CALLED', 'TICKET_SERVED', 'TICKET_SKIPPED', 'PAYMENT_CONFIRMED', 'QUEUE_UPDATED', 'SERVICE_UPDATED'].includes(msg.type)) {
        loadData();
        if (msg.type === 'TICKET_CALLED') {
          playChime();
        }
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [loadData, playChime]);

  const activeCalls = rows.filter(r => r.called);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="6" fill="#00A693"/>
            <rect x="18" y="8" width="4" height="24" rx="2" fill="white"/>
            <rect x="8" y="18" width="24" height="4" rx="2" fill="white"/>
            <circle cx="20" cy="20" r="6" stroke="white" strokeWidth="2" fill="none" opacity="0.4"/>
          </svg>
          <div>
            <div className="text-xl font-bold tracking-tight">
              Hos<span style={{ color: '#00A693' }}>QUEUE</span>
            </div>
            <div className="text-[10px] font-mono tracking-widest uppercase opacity-60">Écran d'affichage en direct</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
            className="px-3 py-1.5 text-xs font-mono border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold tracking-tight text-teal-400">
              {time.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-white/50 font-mono">
              {time.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-hidden flex flex-col justify-between">
        {activeCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center">
            <div className="w-24 h-24 rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <p className="text-3xl font-serif font-semibold opacity-60">{lang === 'fr' ? 'En attente d\'appel' : 'Awaiting call'}</p>
              <p className="text-base text-white/40 mt-2">{lang === 'fr' ? 'Les prochains numéros de tickets appelés s\'afficheront ici instantanément.' : 'Called ticket numbers will appear here in real time.'}</p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-6 flex-1 ${activeCalls.length === 1 ? 'grid-cols-1' : activeCalls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {activeCalls.map(({ service: s, called }) => (
              <div key={s.id} className="bg-slate-800/60 border-2 border-teal-500/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-5 relative overflow-hidden shadow-2xl backdrop-blur-md">
                {/* Accent glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-2">
                  <p className="text-base font-semibold uppercase tracking-widest text-teal-300">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                  <div className="w-12 h-1 bg-teal-400 mx-auto rounded-full" />
                </div>

                <div className="relative z-10 my-2">
                  <p className="text-8xl font-mono font-extrabold text-white leading-none tracking-tight drop-shadow-[0_0_25px_rgba(20,184,166,0.5)] animate-pulse">
                    {called!.number}
                  </p>
                </div>

                <div className="relative z-10 space-y-1">
                  <p className="text-2xl font-bold text-white/95">{called!.patientName}</p>
                  <p className="text-sm text-white/60 font-mono">
                    {lang === 'fr' ? 'Appelé à' : 'Called at'} {called!.calledAt ? new Date(called!.calledAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                </div>

                <div className="relative z-10 px-6 py-2.5 bg-teal-500/20 border border-teal-400/40 rounded-full shadow-inner">
                  <p className="text-teal-300 text-sm font-bold tracking-wide">
                    {lang === 'fr' ? '→ Veuillez vous présenter au bureau' : '→ Please proceed to the office'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service status bar */}
        {rows.length > 0 && (
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, 1fr)` }}>
            {rows.map(({ service: s, servedToday, waitingCount }) => (
              <div key={s.id} className="bg-slate-800/40 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between backdrop-blur-xs">
                <div>
                  <p className="text-xs text-white/60 font-semibold">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                  <p className="text-sm font-bold mt-1 text-white font-mono">{waitingCount} {lang === 'fr' ? 'en attente' : 'waiting'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">{lang === 'fr' ? 'Servis aujourd\'hui' : 'Served'}</p>
                  <p className="text-xl font-mono font-bold text-teal-400">{servedToday}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-8 py-3.5 border-t border-white/10 bg-slate-900/40 flex items-center justify-between text-xs font-mono text-white/40">
        <span>HosQUEUE · {lang === 'fr' ? 'Système temps réel WebSocket' : 'Real-time WebSocket active'}</span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          {lang === 'fr' ? 'Connecté' : 'Connected'}
        </span>
      </footer>
    </div>
  );
}
