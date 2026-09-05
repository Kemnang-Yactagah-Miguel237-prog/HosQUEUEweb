import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLang, useAuth } from '../../lib/store';
import { getTicketsByPatient, getServiceById, getQueuePosition, getEstimatedWait, updateTicket, type Ticket } from '../../lib/db';

function TicketCard({ ticket, onCancel }: { ticket: Ticket; onCancel: () => void }) {
  const { t, lang } = useLang();
  const service = getServiceById(ticket.serviceId);
  const position = ticket.status === 'waiting' ? getQueuePosition(ticket.id) : null;
  const wait = position ? getEstimatedWait(position) : null;
  const serviceName = service ? (lang === 'fr' ? service.nameFr : service.nameEn) : '';

  const isYourTurn = ticket.status === 'called';
  const isActive = ticket.status === 'waiting' || ticket.status === 'called';

  const statusColors: Record<string, string> = {
    waiting: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    called: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    served: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    pending_payment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Ticket ${ticket.number}</title>
      <style>body{font-family:monospace;padding:30px;max-width:300px;margin:0 auto;}h1{font-size:48px;text-align:center;margin:10px 0;}p{margin:4px 0;font-size:14px;}.sep{border-top:1px dashed #ccc;margin:12px 0;}</style>
      </head><body>
      <div style="text-align:center;margin-bottom:12px"><strong>HosQUEUE</strong></div>
      <div class="sep"></div>
      <h1>${ticket.number}</h1>
      <div class="sep"></div>
      <p><strong>${lang === 'fr' ? 'Service' : 'Service'}:</strong> ${serviceName}</p>
      <p><strong>${lang === 'fr' ? 'Position' : 'Position'}:</strong> ${position ?? 'N/A'}</p>
      <p><strong>${lang === 'fr' ? 'Attente estimée' : 'Est. wait'}:</strong> ${wait ? wait + ' min' : 'N/A'}</p>
      <p><strong>${lang === 'fr' ? 'Référence' : 'Ref'}:</strong> ${ticket.paymentRef ?? 'N/A'}</p>
      <p style="font-size:11px;color:#666;margin-top:12px">${new Date(ticket.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</p>
      <div class="sep"></div>
      <p style="text-align:center;font-size:11px">Merci / Thank you</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className={`bg-card border rounded overflow-hidden ${isYourTurn ? 'border-emerald-400 dark:border-emerald-600 shadow-md' : 'border-border'}`}>
      {isYourTurn && (
        <div className="bg-emerald-500 px-4 py-2 flex items-center gap-2 text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="font-semibold text-sm">{t('yourTurn')} {t('yourTurnMsg')}</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{serviceName}</p>
            <p className="text-4xl font-mono font-bold text-primary mt-1">{ticket.number}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[ticket.status] ?? ''}`}>
            {t(ticket.status as any)}
          </span>
        </div>

        {ticket.status === 'waiting' && position !== null && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-muted rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">{t('position')}</p>
              <p className="text-2xl font-mono font-bold text-foreground">{position}</p>
              <p className="text-[10px] text-muted-foreground">{t('peopleAhead')}</p>
            </div>
            <div className="bg-muted rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">{t('waitTime')}</p>
              <p className="text-2xl font-mono font-bold text-primary">{wait}</p>
              <p className="text-[10px] text-muted-foreground">{t('minutes')}</p>
            </div>
          </div>
        )}

        {isActive && (
          <div className="mt-4 flex gap-2">
            <button onClick={handlePrint}
              className="flex-1 py-2 text-xs font-semibold border border-border rounded hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              {t('downloadTicket')}
            </button>
            {ticket.status === 'waiting' && (
              <button onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold border border-red-200 text-red-600 dark:border-red-900 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                {t('cancelTicket')}
              </button>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground font-mono mt-3">
          {new Date(ticket.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {ticket.paymentRef && ` · ${ticket.paymentRef}`}
        </p>
      </div>
    </div>
  );
}

export default function MyQueue() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    const tk = getTicketsByPatient(user.id)
      .filter(t => t.status !== 'cancelled')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setTickets(tk);
  };

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [user]);

  const handleCancel = (id: string) => {
    updateTicket(id, { status: 'cancelled' });
    setConfirmId(null);
    load();
  };

  const active = tickets.filter(t => t.status === 'waiting' || t.status === 'called');
  const history = tickets.filter(t => t.status !== 'waiting' && t.status !== 'called');

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-serif">{t('myQueue')}</h1>

      {active.length === 0 && history.length === 0 && (
        <div className="text-center py-16 space-y-3 text-muted-foreground">
          <svg className="mx-auto opacity-30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          <p className="text-sm font-medium">{t('noActiveTicket')}</p>
          <p className="text-xs">{t('bookToJoin')}</p>
          <button onClick={() => navigate('/patient')} className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded hover:opacity-90 transition-opacity">
            {t('services')}
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Tickets actifs' : 'Active tickets'}</h2>
          {active.map(tk => (
            <TicketCard key={tk.id} ticket={tk} onCancel={() => setConfirmId(tk.id)} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{lang === 'fr' ? 'Historique' : 'History'}</h2>
          {history.slice(0, 5).map(tk => (
            <TicketCard key={tk.id} ticket={tk} onCancel={() => {}} />
          ))}
        </div>
      )}

      {/* Cancel confirm dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold">{t('cancelConfirm')}</h3>
            <p className="text-sm text-muted-foreground">{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2 border border-border rounded text-sm hover:bg-muted transition-colors">{t('no')}</button>
              <button onClick={() => handleCancel(confirmId)} className="flex-1 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors">{t('yes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
