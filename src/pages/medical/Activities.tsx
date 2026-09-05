import { useState, useEffect } from 'react';
import { useLang, useAuth } from '../../lib/store';
import { getTodayTickets, getServiceById, type Ticket } from '../../lib/db';

const statusColors: Record<string, string> = {
  served: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  called: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  waiting: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function Activities() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const serviceId = user?.serviceId;
  const service = serviceId ? getServiceById(serviceId) : null;

  const load = () => {
    if (!serviceId) return;
    setTickets(getTodayTickets(serviceId).filter(tk => tk.status !== 'pending_payment' && tk.status !== 'waiting').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [serviceId]);

  const served = tickets.filter(t => t.status === 'served').length;
  const skipped = tickets.filter(t => t.status === 'skipped').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif">{t('todayActivity')}</h1>
        {service && <p className="text-sm text-muted-foreground mt-0.5">{lang === 'fr' ? service.nameFr : service.nameEn}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{t('processedToday')}</p>
          <p className="text-3xl font-mono font-bold text-foreground mt-1">{tickets.length}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded p-4 text-center">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wide font-semibold">{t('servedToday')}</p>
          <p className="text-3xl font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1">{served}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-4 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wide font-semibold">{t('skippedToday')}</p>
          <p className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-400 mt-1">{skipped}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Détail des patients' : 'Patient details'}</h2>
        </div>
        {tickets.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('ticketNumber')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('name')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">{lang === 'fr' ? 'Heure' : 'Time'}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(tk => (
                  <tr key={tk.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{tk.number}</td>
                    <td className="px-4 py-3 font-medium">{tk.patientName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                      {tk.servedAt ? new Date(tk.servedAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[tk.status] ?? ''}`}>
                        {t(tk.status as any)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
