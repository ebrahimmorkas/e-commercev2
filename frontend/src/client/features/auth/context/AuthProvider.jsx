import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { setAccessToken, clearAccessToken, onSessionExpired } from '../../../../utils/apiClient';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the storefront customer session: current user, login/register/logout,
 * and a silent refresh on mount so a page reload stays logged in as long as
 * the refresh-token cookie is still valid. Mirrors
 * admin/features/login/context/AuthProvider.jsx - kept separate because the
 * admin and client apps never mount at the same time (see main.jsx), so
 * there's no shared session to coordinate.
 */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      toast.error('Your session has expired. Please log in again.');
    });
  }, [clearSession, toast]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await authApi.refreshToken();
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (identifier, password) => {
    try {
      const data = await authApi.login(identifier, password);
      setAccessToken(data.accessToken);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed' };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      await authApi.register(payload);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort - clear the local session regardless of whether the server call succeeded
    }
    clearSession();
    toast.info('You have been logged out.');
  }, [clearSession, toast]);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
