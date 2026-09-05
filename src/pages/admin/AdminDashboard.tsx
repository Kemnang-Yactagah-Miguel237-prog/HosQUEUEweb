import { useState, useEffect } from 'react';
import { useLang } from '../../lib/store';
import { getServices, getTickets, getUsers } from '../../lib/db';

interface Alert { level: 'warn' | 'critical'; service: string; count: number; }

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState({ waiting: 0, served: 0, staff: 0, services: 0 });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [serviceStats, setServiceStats] = useState<{ nameFr: string; nameEn: string; waiting: number; served: number; id: string }[]>([]);

  const load = () => {
    const services = getServices();
    const tickets = getTickets();
    const users = getUsers();
    const today = new Date().toDateString();

    const todayTickets = tickets.filter(tk => new Date(tk.createdAt).toDateString() === today);
    const totalWaiting = tickets.filter(tk => tk.status === 'waiting').length;
    const totalServed = todayTickets.filter(tk => tk.status === 'served').length;
    const activeStaff = users.filter(u => u.role === 'medical' && !u.suspended).length;
    const activeServices = services.filter(s => s.active).length;

    setStats({ waiting: totalWaiting, served: totalServed, staff: activeStaff, services: activeServices });

    const newAlerts: Alert[] = [];
    const svcStats = services.filter(s => s.active).map(s => {
      const w = tickets.filter(tk => tk.serviceId === s.id && tk.status === 'waiting').length;
      const sv = todayTickets.filter(tk => tk.serviceId === s.id && tk.status === 'served').length;
      if (w >= 10) newAlerts.push({ level: 'critical', service: lang === 'fr' ? s.nameFr : s.nameEn, count: w });
      else if (w >= 5) newAlerts.push({ level: 'warn', service: lang === 'fr' ? s.nameFr : s.nameEn, count: w });
      return { id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, waiting: w, served: sv };
    });
    setAlerts(newAlerts);
    setServiceStats(svcStats);
  };

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [lang]);

  const statCards = [
    { label: t('totalWaiting'), value: stats.waiting, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('totalServed'), value: stats.served, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950' },
    { label: t('activeStaff'), value: stats.staff, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, color: 'text-accent', bg: 'bg-accent/10' },
    { label: t('activeServices'), value: stats.services, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif">{t('dashboard')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded ${s.bg} flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold leading-tight">{s.label}</p>
              <p className={`text-3xl font-mono font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('alerts')}</h2>
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded border ${a.level === 'critical' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-sm font-medium">{a.level === 'critical' ? t('queueCritical') : t('queueBusy')}: <strong>{a.service}</strong> — {a.count} {lang === 'fr' ? 'patients' : 'patients'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Service overview table */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Aperçu des services' : 'Service overview'}</h2>
        </div>
        {serviceStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('service')}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('totalWaiting')}</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('totalServed')}</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Charge' : 'Load'}</th>
                </tr>
              </thead>
              <tbody>
                {serviceStats.map(s => {
                  const load = Math.min(100, Math.round((s.waiting / 10) * 100));
                  const loadColor = s.waiting >= 10 ? 'bg-red-500' : s.waiting >= 5 ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{lang === 'fr' ? s.nameFr : s.nameEn}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-primary">{s.waiting}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{s.served}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${loadColor}`} style={{ width: `${load}%` }} />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground w-8 text-right">{load}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
