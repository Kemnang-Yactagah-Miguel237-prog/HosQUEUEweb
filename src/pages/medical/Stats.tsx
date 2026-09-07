import { useState, useEffect, useCallback } from 'react';
import { useLang, useAuth } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Ticket, Service } from '../../lib/db';

export default function Stats() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [service, setService] = useState<Service | null>(null);

  const serviceId = user?.serviceId;

  const loadData = useCallback(async () => {
    if (!serviceId) return;
    try {
      const [svc, allTickets] = await Promise.all([
        api.services.getById(serviceId),
        api.tickets.getAll({ serviceId, today: true })
      ]);
      setService(svc);
      setTickets(allTickets);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }, [serviceId]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeWS((msg) => {
      if (['TICKET_CALLED', 'TICKET_SERVED', 'TICKET_SKIPPED', 'QUEUE_UPDATED'].includes(msg.type)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const served = tickets.filter(t => t.status === 'served');
  const skipped = tickets.filter(t => t.status === 'skipped');
  const total = served.length + skipped.length;

  const avgWait = served.length > 0 ? Math.round(
    served.reduce((acc, tk) => {
      if (!tk.servedAt) return acc;
      return acc + (new Date(tk.servedAt).getTime() - new Date(tk.createdAt).getTime()) / 60000;
    }, 0) / served.length
  ) : 0;

  const servedPct = total > 0 ? Math.round((served.length / total) * 100) : 0;

  const hourBuckets: Record<number, number> = {};
  served.forEach(tk => {
    const h = new Date(tk.createdAt).getHours();
    hourBuckets[h] = (hourBuckets[h] || 0) + 1;
  });
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7AM–6PM
  const maxVal = Math.max(...Object.values(hourBuckets), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">{t('statsTitle')}</h1>
        {service && <p className="text-sm text-muted-foreground mt-0.5">{lang === 'fr' ? service.nameFr : service.nameEn} · {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('processedToday'), value: total, color: 'text-foreground' },
          { label: t('servedToday'), value: served.length, color: 'text-emerald-600' },
          { label: t('skippedToday'), value: skipped.length, color: 'text-amber-600' },
          { label: t('avgWaitTime'), value: `${avgWait}`, suffix: ' min', color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-xs">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold leading-tight">{s.label}</p>
            <p className={`text-3xl font-mono font-bold mt-1 ${s.color}`}>{s.value}<span className="text-sm text-muted-foreground font-normal">{s.suffix}</span></p>
          </div>
        ))}
      </div>

      {/* Served/skipped ratio */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Taux de service' : 'Service rate'}</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${servedPct}%` }} />
            </div>
            <span className="text-sm font-mono font-bold text-emerald-600 w-12 text-right">{servedPct}%</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t('servedToday')}: {served.length}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{t('skippedToday')}: {skipped.length}</span>
          </div>
        </div>
      )}

      {/* Hourly chart */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Activité par heure' : 'Hourly activity'}</h2>
        <div className="flex items-end gap-1.5 h-24">
          {hours.map(h => {
            const count = hourBuckets[h] || 0;
            const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;
            const now = new Date().getHours();
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t transition-all duration-700 ${h === now ? 'bg-primary' : 'bg-primary/30'}`}
                    style={{ height: `${Math.max(pct, count > 0 ? 8 : 2)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{h}h</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
