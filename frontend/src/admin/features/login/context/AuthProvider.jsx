import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import { setAccessToken, clearAccessToken, onSessionExpired } from '../../../../utils/apiClient';
import { useToast } from '../../../../components/common/Toast';

// Access tokens carry no signature-sensitive info worth hiding client-side; decoding the
// payload (without verifying it - the server always does that) just lets us show a minimal
// identity after a silent refresh, when the login response body isn't available to read from.
const decodeTokenPayload = (token) => {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

/**
 * Owns the admin session: current user, login/logout, and a silent refresh on
 * mount so a page reload stays logged in as long as the refresh-token cookie
 * is still valid.
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
        setUser(decodeTokenPayload(data.accessToken));
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

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort - clear the local session regardless of whether the server call succeeded
    }
    clearSession();
    toast.success('Logged out successfully');
  }, [clearSession, toast]);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
