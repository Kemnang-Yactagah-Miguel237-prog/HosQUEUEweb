import { useState, useEffect } from 'react';
import { useLang } from '../../lib/store';
import { getServices, getWaitingTickets, getCalledTicket, getTodayTickets, getTickets, getUsers, updateUser, type Service } from '../../lib/db';

interface ServiceRow { service: Service; waiting: number; called: string | null; served: number; staffName: string | null; }

export default function GlobalQueue() {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [staffForService, setStaffForService] = useState<string>('');

  const load = () => {
    const services = getServices();
    const users = getUsers();
    const data: ServiceRow[] = services.map(s => {
      const waiting = getWaitingTickets(s.id).length;
      const called = getCalledTicket(s.id)?.number ?? null;
      const served = getTodayTickets(s.id).filter(tk => tk.status === 'served').length;
      const staff = users.find(u => u.role === 'medical' && u.serviceId === s.id && !u.suspended);
      return { service: s, waiting, called, served, staffName: staff?.name ?? null };
    });
    setRows(data);
  };

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, []);

  const exportCSV = () => {
    const tickets = getTickets();
    const services = getServices();
    const svcMap = Object.fromEntries(services.map(s => [s.id, lang === 'fr' ? s.nameFr : s.nameEn]));
    const header = lang === 'fr'
      ? ['Numéro', 'Patient', 'Service', 'Statut', 'Créé le', 'Référence paiement']
      : ['Number', 'Patient', 'Service', 'Status', 'Created', 'Payment ref'];
    const rows = tickets.map(tk => [
      tk.number, tk.patientName, svcMap[tk.serviceId] ?? tk.serviceId,
      tk.status, new Date(tk.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US'),
      tk.paymentRef ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hosqueue-export-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const medicalUsers = getUsers().filter(u => u.role === 'medical' && !u.suspended);

  const handleAssign = () => {
    if (!assignModal) return;
    if (staffForService) {
      updateUser(staffForService, { serviceId: assignModal });
    }
    load();
    setAssignModal(null);
  };

  const loadBgColor = (w: number) => w >= 10 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
    : w >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-serif">{t('globalQueueTitle')}</h1>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded hover:bg-muted transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {t('exportCSV')}
        </button>
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {[t('service'), t('totalWaiting'), lang === 'fr' ? 'Appelé' : 'Called', t('totalServed'), t('assignedStaff'), t('actions')].map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${i === 0 ? 'text-left' : 'text-center'} ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ service: s, waiting, called, served, staffName }) => (
                <tr key={s.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{lang === 'fr' ? s.nameFr : s.nameEn}</p>
                    {!s.active && <span className="text-[10px] text-muted-foreground">{t('serviceInactiveLabel')}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${loadBgColor(waiting)}`}>{waiting}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm font-bold text-primary">{called ?? '—'}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{served}</td>
                  <td className="px-4 py-3 text-center">
                    {staffName ? (
                      <span className="text-xs font-medium">{staffName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('noStaff')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setAssignModal(s.id); setStaffForService(''); }}
                      className="text-xs font-medium text-primary hover:underline">
                      {t('assignStaff')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</p>}
        </div>
      </div>

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded w-full max-w-sm overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-serif text-lg">{t('assignStaff')}</h3>
              <button onClick={() => setAssignModal(null)} className="text-muted-foreground hover:text-foreground"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Sélectionnez un membre du personnel médical' : 'Select a medical staff member'}</p>
              <select value={staffForService} onChange={e => setStaffForService(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">—</option>
                {medicalUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}{u.serviceId ? ` (${lang === 'fr' ? getServices().find(s => s.id === u.serviceId)?.nameFr : getServices().find(s => s.id === u.serviceId)?.nameEn})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted">{t('cancel')}</button>
              <button onClick={handleAssign} className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
