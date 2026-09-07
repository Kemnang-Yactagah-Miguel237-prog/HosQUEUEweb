import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from './db';
import { api, getToken } from './api';
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
    const val = (translations[lang] as unknown as Record<string, string>)[key];
    return val ?? key;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }

// Auth
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerFirstAdmin: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  registerFirstAdmin: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('hq_session') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Rehydrate user from backend if token exists
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.auth.getMe()
        .then(res => {
          setUser(res.user);
          sessionStorage.setItem('hq_session', JSON.stringify(res.user));
        })
        .catch(() => {
          setUser(null);
          sessionStorage.removeItem('hq_session');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.auth.login(email, password);
      sessionStorage.setItem('hq_session', JSON.stringify(res.user));
      setUser(res.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.code || 'loginError' };
    }
  }, []);

  const registerFirstAdmin = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.auth.registerFirstAdmin(name, email, password);
      sessionStorage.setItem('hq_session', JSON.stringify(res.user));
      setUser(res.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.code || 'registrationClosed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      sessionStorage.removeItem('hq_session');
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.getMe();
      sessionStorage.setItem('hq_session', JSON.stringify(res.user));
      setUser(res.user);
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, registerFirstAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
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
