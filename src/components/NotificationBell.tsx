import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useLang } from '../lib/store';
import { api, subscribeWS } from '../lib/api';
import type { Notification } from '../lib/db';

export default function NotificationBell() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    if (user) {
      api.notifications.getAll()
        .then(setNotifs)
        .catch(err => console.error('Failed to load notifications', err));
    }
  }, [user]);

  useEffect(() => {
    reload();
    // Subscribe to real-time WebSocket notifications
    const unsubscribe = subscribeWS((msg) => {
      if (msg.type === 'NOTIFICATION_CREATED' || msg.type === 'TICKET_CALLED' || msg.type === 'PAYMENT_CONFIRMED') {
        reload();
      }
    });
    return () => unsubscribe();
  }, [reload]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const handleOpen = () => { setOpen(v => !v); };
  const handleRead = async (id: string) => {
    await api.notifications.markRead(id);
    reload();
  };
  const handleReadAll = async () => {
    if (user) {
      await api.notifications.markAllRead();
      reload();
    }
  };

  const msg = (n: Notification) => lang === 'fr' ? n.messageFr : n.messageEn;

  const typeIcon: Record<string, string> = {
    account_created: '👤', payment_confirmed: '✅', turn_soon: '⏱️', your_turn: '🔔', general: 'ℹ️',
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-2 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-mono font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">{t('notifications')}</span>
            {unread > 0 && (
              <button onClick={handleReadAll} className="text-xs text-primary hover:underline">{t('markAllRead')}</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">{t('noNotifications')}</p>
            ) : notifs.map(n => (
              <button key={n.id} onClick={() => handleRead(n.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}>
                <span className="text-base mt-0.5 shrink-0">{typeIcon[n.type] || 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>{msg(n)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">{new Date(n.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
