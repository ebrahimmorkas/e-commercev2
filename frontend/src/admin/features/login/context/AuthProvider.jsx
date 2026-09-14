import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import * as authApi from '../api/authApi';
import {
  setAccessToken,
  clearAccessToken,
  onSessionExpired,
  hasSessionHint,
  setSessionHint,
  clearSessionHint,
} from '../../../../utils/apiClient';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the admin session: current user, login/logout, and a silent refresh on
 * mount so a page reload stays logged in as long as the refresh-token cookie
 * is still valid.
 */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Starts false (nothing to wait on) unless there's a hint this browser has
  // logged in before, in which case the mount effect below needs to confirm
  // via a silent refresh first.
  const [isLoading, setIsLoading] = useState(() => hasSessionHint());
  const toast = useToast();

  // Clears this tab's in-memory session only - used when the account behind
  // the refresh-token cookie is still valid but isn't an admin, so the "has
  // ever logged in" hint must survive for the storefront to pick it up.
  const clearLocalState = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  // Full clear for when the session is actually gone (logout, expired/invalid
  // refresh token) - also drops the hint so future loads don't bother refreshing.
  const clearSession = useCallback(() => {
    clearLocalState();
    clearSessionHint();
  }, [clearLocalState]);

  useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      toast.error('Your session has expired. Please log in again.');
    });
  }, [clearSession, toast]);

  useEffect(() => {
    let cancelled = false;

    // No hint that this browser has ever logged in - skip the silent
    // refresh entirely rather than firing a request that's guaranteed to
    // 401 for every first-time/logged-out visitor to /admin. (isLoading was
    // already initialized to false above in this case.)
    if (!hasSessionHint()) return;

    (async () => {
      try {
        const data = await authApi.refreshToken();
        if (cancelled) return;
        // The refresh-token cookie is shared with the storefront session, so a
        // customer who wandered to /admin can silently "refresh" here too -
        // only a real admin role gets seated.
        if (data.user?.role !== 'admin') {
          clearLocalState();
          return;
        }
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
  }, [clearSession, clearLocalState]);

  const login = useCallback(async (identifier, password) => {
    try {
      const data = await authApi.login(identifier, password);
      // A successful login always issues a real refresh-token cookie
      // server-side regardless of role, so the hint must be set even when
      // we refuse to seat a non-admin account here.
      setSessionHint();
      if (data.user?.role !== 'admin') {
        clearAccessToken();
        return { success: false, message: 'This account does not have admin access.' };
      }
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
