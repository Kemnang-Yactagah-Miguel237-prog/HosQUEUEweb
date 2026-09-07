import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../lib/store';
import { api, subscribeWS } from '../../lib/api';
import type { Service, Ticket, User } from '../../lib/db';

interface ServiceRow { service: Service; waiting: number; called: string | null; served: number; staffName: string | null; }

export default function GlobalQueue() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [staffForService, setStaffForService] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [svcList, tks, userList] = await Promise.all([
        api.services.getAll(),
        api.tickets.getAll(),
        api.users.getAll()
      ]);

      setServices(svcList);
      setAllTickets(tks);
      setUsers(userList);

      const todayStr = new Date().toDateString();
      const todayTickets = tks.filter(tk => new Date(tk.createdAt).toDateString() === todayStr);

      const data: ServiceRow[] = svcList.map(s => {
        const waiting = tks.filter(tk => tk.serviceId === s.id && tk.status === 'waiting').length;
        const called = tks.find(tk => tk.serviceId === s.id && tk.status === 'called')?.number ?? null;
        const served = todayTickets.filter(tk => tk.serviceId === s.id && tk.status === 'served').length;
        const staff = userList.find(u => u.role === 'medical' && u.serviceId === s.id && !u.suspended);
        return { service: s, waiting, called, served, staffName: staff?.name ?? null };
      });

      setRows(data);
    } catch (err) {
      console.error('Failed to load global queue', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeWS((msg) => {
      if (['TICKET_CREATED', 'TICKET_CALLED', 'TICKET_SERVED', 'TICKET_SKIPPED', 'PAYMENT_CONFIRMED', 'SERVICE_UPDATED', 'QUEUE_UPDATED'].includes(msg.type)) {
        loadData();
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const exportCSV = () => {
    const svcMap = Object.fromEntries(services.map(s => [s.id, lang === 'fr' ? s.nameFr : s.nameEn]));
    const header = lang === 'fr'
      ? ['Numéro', 'Patient', 'Service', 'Statut', 'Créé le', 'Référence paiement']
      : ['Number', 'Patient', 'Service', 'Status', 'Created', 'Payment ref'];
    const csvRows = allTickets.map(tk => [
      tk.number, tk.patientName, svcMap[tk.serviceId] ?? tk.serviceId,
      tk.status, new Date(tk.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US'),
      tk.paymentRef ?? '',
    ]);
    const csv = [header, ...csvRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hosqueue-export-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const medicalUsers = users.filter(u => u.role === 'medical' && !u.suspended);

  const handleAssign = async () => {
    if (!assignModal) return;
    if (staffForService) {
      try {
        await api.users.update(staffForService, { serviceId: assignModal });
        await loadData();
      } catch (err) {
        console.error('Failed to assign staff', err);
      }
    }
    setAssignModal(null);
  };

  const loadBgColor = (w: number) => w >= 10 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
    : w >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-serif font-bold">{t('globalQueueTitle')}</h1>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-xl hover:bg-muted transition-colors shadow-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {t('exportCSV')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {[t('service'), t('totalWaiting'), lang === 'fr' ? 'Appelé' : 'Called', t('totalServed'), t('assignedStaff'), t('actions')].map((h, i) => (
                  <th key={i} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${i === 0 ? 'text-left' : 'text-center'} ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ service: s, waiting, called, served, staffName }) => (
                <tr key={s.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                    {!s.active && <span className="text-[10px] text-muted-foreground">{t('serviceInactiveLabel')}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${loadBgColor(waiting)}`}>{waiting}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono text-sm font-bold text-primary">{called ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-emerald-600">{served}</td>
                  <td className="px-5 py-3.5 text-center">
                    {staffName ? (
                      <span className="text-xs font-medium text-foreground">{staffName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('noStaff')}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => { setAssignModal(s.id); setStaffForService(medicalUsers.find(u => u.serviceId === s.id)?.id || ''); }}
                      className="px-3 py-1 text-xs font-semibold border border-border rounded-lg hover:bg-muted transition-colors">
                      {t('assignStaff')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-semibold text-foreground text-lg">{t('assignStaff')}</h3>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('selectStaff')}</label>
              <select value={staffForService} onChange={e => setStaffForService(e.target.value)}
                className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">{lang === 'fr' ? '— Aucun soignant —' : '— None —'}</option>
                {medicalUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">{t('cancel')}</button>
              <button onClick={handleAssign} className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
