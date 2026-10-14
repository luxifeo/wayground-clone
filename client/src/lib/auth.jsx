import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(d.token); setUser(d.user);
    return d.user;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const d = await api('/auth/signup', { method: 'POST', body: { name, email, password } });
    setToken(d.token); setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  return <AuthCtx.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const { t } = useTranslation();
  if (loading) return <div className="grid h-full place-items-center text-slate-400">{t('status.loading')}</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}
