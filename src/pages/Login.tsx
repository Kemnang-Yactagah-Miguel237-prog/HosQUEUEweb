import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import Logo from '../components/Logo';
import { useAuth, useLang, useTheme } from '../lib/store';
import { getUsers } from '../lib/db';
import type { Role } from '../lib/db';

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 w-5 h-5 rounded bg-white/10 flex items-center justify-center shrink-0 text-white/90">{icon}</span>
      <span className="text-sm text-white/80 leading-snug">{text}</span>
    </li>
  );
}

export default function Login() {
  const { user, login, registerFirstAdmin } = useAuth();
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hasAdmin = getUsers().some(existing => existing.role === 'admin');
  const isFirstAdmin = selectedRole === 'admin' && !hasAdmin;

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'medical') navigate('/medical');
      else navigate('/patient');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    if (isFirstAdmin && password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      setLoading(false);
      return;
    }
    const result = isFirstAdmin ? registerFirstAdmin(name, email, password) : login(email, password);
    setLoading(false);
    if (!result.success) { setError(t(result.error as any)); return; }
  };

  const roles: { key: Role; icon: React.ReactNode }[] = [
    { key: 'patient', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { key: 'medical', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg> },
    { key: 'admin', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  ];

  const roleDescKey: Record<Role, any> = {
    patient: 'rolePatientDesc', medical: 'roleMedicalDesc', admin: 'roleAdminDesc',
  };

  return (
    <div className="min-h-full flex bg-background">
      {/* Left panel — Navy */}
      <div
        className="hidden lg:flex lg:w-[45%] bg-navy flex-col justify-between p-10 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('/photo_2026-09-05_22-13-59.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#063b78]/65" aria-hidden="true" />
        {/* Swiss grid accent */}
        <div className="absolute inset-0 pointer-events-none z-[1]">
          <div className="absolute top-0 right-0 w-40 h-40 border-r-2 border-t-2 border-white/5 rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-60 h-60 border-l-2 border-b-2 border-teal/10 rounded-tr-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-white/[0.03] rounded-full" />
        </div>

        <div className="relative z-10"><Logo size="lg" inverted /></div>

        <div className="space-y-6 relative z-10">
          <div>
            <h1 className="text-3xl font-serif text-white leading-tight mb-2">{t('tagline')}</h1>
            <div className="w-12 h-0.5 bg-teal mt-3" />
          </div>
          <ul className="space-y-4">
            {(translations_features[lang] || []).map((f, i) => (
                <FeatureItem key={i} text={f} icon={featureIcons[i]} />
              ))}
          </ul>
        </div>

        <p className="text-white/30 text-xs font-mono relative z-10">© {new Date().getFullYear()} HosQUEUE · v1.0</p>
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="lg:hidden"><Logo size="sm" /></div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="px-2.5 py-1 text-xs font-mono font-semibold border border-border rounded hover:bg-muted transition-colors">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={toggleTheme} className="p-2 rounded hover:bg-muted transition-colors">
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.592-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-2xl font-serif text-foreground">{isFirstAdmin ? t('registerTitle') : (lang === 'fr' ? 'Bienvenue' : 'Welcome')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{isFirstAdmin ? t('firstAdminNotice') : t('chooseRole')}</p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-3 gap-3">
              {roles.map(r => (
                <button key={r.key} onClick={() => { setSelectedRole(r.key); setEmail(''); setPassword(''); }}
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded transition-all ${selectedRole === r.key ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'}`}>
                  {r.icon}
                  <span className="text-xs font-semibold">{t(r.key)}</span>
                  <span className="text-[10px] text-center opacity-70 leading-tight hidden sm:block">{t(roleDescKey[r.key])}</span>
                </button>
              ))}
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isFirstAdmin && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('fullName')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required
                    className="w-full px-3 py-2.5 bg-card border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('email')}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder={selectedRole ? `ex. user@hosqueue.com` : ''}
                  className="w-full px-3 py-2.5 bg-card border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow" />
              </div>

              {isFirstAdmin && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('confirmPassword')}</label>
                  <input type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                    className="w-full px-3 py-2.5 bg-card border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t('password')}</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full px-3 py-2.5 pr-10 bg-card border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow" />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2.5 rounded">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    {t('loading')}
                  </>
                ) : isFirstAdmin ? t('registerBtn') : t('loginButton')}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div className="border border-border/60 rounded p-3 bg-muted/30">
              <p className="text-[10px] font-mono text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">{isFirstAdmin ? t('firstAdminNotice') : 'Demo credentials'}</p>
              <div className="grid grid-cols-1 gap-0.5 text-[10px] font-mono text-muted-foreground">
                <span>dr.martin@hosqueue.com / Staff@123</span>
                <span>jean.dupont@hosqueue.com / Patient@123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const featureIcons = [
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M12 18v3M8 21h8"/></svg>,
];

import { translations } from '../lib/i18n';
const translations_features: Record<string, string[]> = {
  fr: translations.fr.features as unknown as string[],
  en: translations.en.features as unknown as string[],
};
