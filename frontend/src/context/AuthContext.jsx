import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, refreshSession } from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const normalize = (u) => u && { id: u.id || u._id, name: u.name, email: u.email, role: u.role };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  // restore the session from the refresh cookie on first load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshSession();
        const d = await api('/auth/me');
        if (alive) setUser(normalize(d.user));
      } catch {
        /* not signed in */
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const onExpired = () => {
      setAccessToken(null);
      setUser(null);
      qc.clear();
    };
    window.addEventListener('auth:expired', onExpired);
    return () => {
      alive = false;
      window.removeEventListener('auth:expired', onExpired);
    };
  }, [qc]);

  const start = useCallback(
    (d) => {
      setAccessToken(d.accessToken);
      setUser(normalize(d.user));
      qc.invalidateQueries();
    },
    [qc]
  );

  const login = useCallback(
    async (email, password) => start(await api('/auth/login', { method: 'POST', body: { email, password } })),
    [start]
  );

  const register = useCallback(
    async (name, email, password) =>
      start(await api('/auth/register', { method: 'POST', body: { name, email, password } })),
    [start]
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* clear locally anyway */
    }
    setAccessToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}