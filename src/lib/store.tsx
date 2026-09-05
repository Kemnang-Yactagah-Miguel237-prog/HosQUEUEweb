import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from './db';
import { createUser, getUserByEmail, getUserById, getUsers, logActivity, updateUser, initDB } from './db';
import type { Lang } from './i18n';
import { translations } from './i18n';

// Theme
interface ThemeCtx { theme: 'light' | 'dark'; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('hq_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('hq_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

// Language
interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (key: keyof typeof translations.fr) => string; }
const LangContext = createContext<LangCtx>({ lang: 'fr', setLang: () => {}, t: k => k });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('hq_lang') as Lang) || 'fr';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('hq_lang', l);
  }, []);

  const t = useCallback((key: keyof typeof translations.fr): string => {
    return (translations[lang] as Record<string, string>)[key] ?? key;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }

// Auth
interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  registerFirstAdmin: (name: string, email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  refreshUser: () => void;
}
const AuthContext = createContext<AuthCtx>({ user: null, login: () => ({ success: false }), registerFirstAdmin: () => ({ success: false }), logout: () => {}, refreshUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('hq_session') || 'null'); } catch { return null; }
  });

  useEffect(() => { initDB(); }, []);

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    const found = getUserByEmail(email);
    if (!found || found.password !== password) return { success: false, error: 'loginError' };
    if (found.suspended) return { success: false, error: 'suspendedError' };
    const updated = updateUser(found.id, { lastLogin: new Date().toISOString() }) || found;
    sessionStorage.setItem('hq_session', JSON.stringify(updated));
    setUser(updated);
    logActivity(found.id, found.name, 'Connexion / Login');
    return { success: true };
  }, []);

  const registerFirstAdmin = useCallback((name: string, email: string, password: string): { success: boolean; error?: string } => {
    if (getUsers().some(existing => existing.role === 'admin')) return { success: false, error: 'registrationClosed' };
    if (getUserByEmail(email)) return { success: false, error: 'emailAlreadyUsed' };
    const { user: created } = createUser({ name, email, password, role: 'admin', createdBy: 'system' });
    sessionStorage.setItem('hq_session', JSON.stringify(created));
    setUser(created);
    logActivity(created.id, created.name, 'Création du premier administrateur / First administrator created');
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    if (user) logActivity(user.id, user.name, 'Déconnexion / Logout');
    sessionStorage.removeItem('hq_session');
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(() => {
    if (!user) return;
    const fresh = getUserById(user.id);
    if (fresh) { sessionStorage.setItem('hq_session', JSON.stringify(fresh)); setUser(fresh); }
  }, [user]);

  return <AuthContext.Provider value={{ user, login, registerFirstAdmin, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

// Combined provider
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>{children}</AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
