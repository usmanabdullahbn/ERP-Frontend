import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

// setTimeout delays overflow to 1 on values >24.8 days; a 1d session never approaches that.
function getTokenExpiryMs(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/*
  Permissions always come from the server's role.permissions[] — never
  inferred from the role's display name. A role literally named "Admin"
  isn't automatically a super-admin; only the '*' wildcard permission is.
*/
function normalizeUser(userData) {
  if (!userData) return null;

  if (typeof userData.role === 'string') {
    return {
      ...userData,
      role: { id: null, name: userData.role, permissions: [] }
    };
  }

  if (userData.role && typeof userData.role === 'object') {
    return {
      ...userData,
      role: {
        id: userData.role.id || null,
        name: userData.role.name || '',
        permissions: userData.role.permissions || []
      }
    };
  }

  return {
    ...userData,
    role: { id: null, name: '', permissions: [] }
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('erp_user');
    if (!raw) return null;
    try {
      return normalizeUser(JSON.parse(raw));
    } catch {
      localStorage.removeItem('erp_user');
      localStorage.removeItem('erp_token');
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const logoutTimer = useRef(null);

  const logout = useCallback(() => {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setUser(null);
  }, []);

  const scheduleAutoLogout = useCallback((token) => {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
    const expiryMs = token && getTokenExpiryMs(token);
    if (!expiryMs) return;

    const delay = expiryMs - Date.now();
    if (delay <= 0) {
      logout();
      return;
    }
    logoutTimer.current = setTimeout(logout, delay);
  }, [logout]);

  // Resume the countdown on refresh/reopen so a session still expires 1d after login, not 1d after the next visit.
  useEffect(() => {
    scheduleAutoLogout(localStorage.getItem('erp_token'));
    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem('erp_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      scheduleAutoLogout(data.token);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.response?.data?.message || 'Login failed.' };
    } finally {
      setLoading(false);
    }
  }, [scheduleAutoLogout]);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem('erp_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      scheduleAutoLogout(data.token);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.response?.data?.message || 'Registration failed.' };
    } finally {
      setLoading(false);
    }
  }, [scheduleAutoLogout]);

  const hasPermission = useCallback(
    (...perms) => {
      const userPerms = user?.role?.permissions || [];
      if (userPerms.includes('*')) return true;
      return perms.some((p) => userPerms.includes(p));
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
