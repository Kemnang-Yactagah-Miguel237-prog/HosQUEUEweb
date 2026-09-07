import { NavLink, Outlet, useNavigate } from 'react-router';
import { useState } from 'react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth, useLang, useTheme } from '../lib/store';

function ThemeLangBar() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        className="px-2.5 py-1 text-xs font-mono font-semibold border border-border rounded hover:bg-muted transition-colors">
        {lang === 'fr' ? 'EN' : 'FR'}
      </button>
      <button onClick={toggleTheme} className="p-2 rounded hover:bg-muted transition-colors" aria-label="Toggle theme">
        {theme === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.592-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd"/></svg>
        )}
      </button>
    </div>
  );
}

export default function Shell() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = user?.role === 'patient' ? [
    { to: '/patient', label: t('home'), end: true },
    { to: '/patient/discover', label: t('discover'), end: true },
    { to: '/patient/queue', label: t('myTicket'), end: true },
    { to: '/patient/queue', label: t('myQueue'), end: false },
  ] : user?.role === 'medical' ? [
    { to: '/medical', label: t('queue'), end: true },
    { to: '/medical/activities', label: t('activities') },
    { to: '/medical/stats', label: t('stats') },
  ] : [
    { to: '/admin', label: t('dashboard'), end: true },
    { to: '/admin/accounts', label: t('accounts') },
    { to: '/admin/services', label: t('services') },
    { to: '/admin/global-queue', label: t('globalQueue') },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  const navIcons = [
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>,
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8"/></svg>,
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-full transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`;

  return (
    <div className="min-h-full flex bg-background">
      <aside className="hidden md:flex w-52 shrink-0 bg-accent text-white flex-col px-4 py-6 sticky top-0 h-screen">
        <div className="px-2 mb-10"><Logo size="sm" inverted /></div>
        <nav className="flex flex-col gap-1">
          {navLinks.map((l, index) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {navIcons[index % navIcons.length]}<span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2">
          {user?.role === 'admin' && <button onClick={() => window.open('/waiting-room', '_blank')} className="w-full rounded-full bg-white text-accent py-2 text-xs font-semibold">{t('waitingRoomDisplay')}</button>}
          <div className="border-t border-white/15 pt-4 space-y-1">
            <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white">{t('support')}</button>
            <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white">{t('logout')}</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-5 h-16 flex items-center gap-4">
            <div className="md:hidden"><Logo size="sm" /></div>
            <div className="hidden md:flex items-center gap-5 flex-1">
              <Logo size="sm" />
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{t(user?.role as any)}</p>
            </div>
            <div className="flex items-center gap-2 ml-auto"><ThemeLangBar /><NotificationBell />
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <div className="hidden sm:block text-right"><p className="text-xs font-semibold leading-none">{user?.name}</p><p className="text-[10px] text-muted-foreground mt-1">{user?.email}</p></div>
                <button className="md:hidden p-2 rounded hover:bg-muted" onClick={() => setMobileOpen(v => !v)} aria-label="Open menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
              </div>
            </div>
          </div>
          {mobileOpen && <nav className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1">{navLinks.map(l => <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `px-3 py-2 text-sm rounded ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{l.label}</NavLink>)}</nav>}
        </header>
        <main className="flex-1 w-full max-w-7xl mx-auto px-5 py-8"><Outlet /></main>
      </div>
    </div>
  );
}
