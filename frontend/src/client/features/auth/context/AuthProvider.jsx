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
import Spinner from '../../../../components/common/Spinner';

/**
 * Owns the storefront customer session: current user, login/register/logout,
 * and a silent refresh on mount so a page reload stays logged in as long as
 * the refresh-token cookie is still valid. Mirrors
 * admin/features/login/context/AuthProvider.jsx as a separate copy since the
 * admin and client apps never mount at the same time (see main.jsx) - but
 * the underlying refresh-token cookie IS shared (see cookieOptions.js), so
 * both providers check `user.role` and bounce admin-role sessions back to
 * /admin rather than seating them here.
 */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Starts false (nothing to wait on) unless there's a hint this browser has
  // logged in before, in which case the mount effect below needs to confirm
  // via a silent refresh first.
  const [isLoading, setIsLoading] = useState(() => hasSessionHint());
  // Separate from isLoading: once an admin session is detected, this stays
  // true forever (isLoading still flips false in `finally`) so the
  // storefront never gets a chance to paint - not even for one frame -
  // before window.location actually navigates away to /admin.
  const [isLeavingForAdmin, setIsLeavingForAdmin] = useState(false);
  const toast = useToast();

  // Clears this tab's in-memory session only - used when the account behind
  // the refresh-token cookie is still valid but doesn't belong seated here
  // (e.g. an admin role bouncing to /admin), so the "has ever logged in"
  // hint must survive for that other context to pick the session back up.
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
    // 401 for every first-time/guest visitor. (isLoading was already
    // initialized to false above in this case.)
    if (!hasSessionHint()) return;

    (async () => {
      try {
        const data = await authApi.refreshToken();
        if (cancelled) return;
        // The refresh-token cookie is shared with the admin session - if an
        // admin ends up here (e.g. they typed over the /admin path segment),
        // don't seat them as a "logged in" storefront customer. Send them
        // back to the admin panel instead.
        if (data.user?.role === 'admin') {
          clearLocalState();
          setIsLeavingForAdmin(true);
          window.location.replace('/admin');
          return;
        }
        setAccessToken(data.accessToken);
        setSessionHint();
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
      setSessionHint();
      if (data.user?.role === 'admin') {
        // An admin signing in through the storefront login belongs in the
        // admin panel, not browsing the storefront with an admin session.
        setAccessToken(data.accessToken);
        setIsLeavingForAdmin(true);
        window.location.href = '/admin';
        return { success: true, redirected: true };
      }
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

  // Block the storefront from mounting at all until we know this isn't an
  // admin session - otherwise the page would paint for a frame before the
  // redirect above takes over.
  if (isLoading || isLeavingForAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
