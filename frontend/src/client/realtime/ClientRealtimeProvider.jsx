import { useCallback, useEffect, useRef } from 'react';
import { ClientRealtimeContext } from './ClientRealtimeContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import {
  connectSocket,
  disconnectSocket,
  onUserNotification,
  onReconnect,
  REALTIME_RECONNECTED,
} from '../../utils/socketClient';

/**
 * Owns the ONE shared socket.io connection for the storefront - connects once
 * the customer is logged in, disconnects on logout. Mirrors the admin
 * RealtimeProvider (admin/realtime/RealtimeProvider.jsx), but listens on the
 * customer channel: the backend only ever delivers a customer's OWN
 * notifications to their own socket. Features subscribe to their `module` via
 * useClientRealtime().subscribe(...) instead of touching the socket directly.
 */
const ClientRealtimeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const listenersRef = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return undefined;
    }

    connectSocket();
    const unsubscribe = onUserNotification((payload) => {
      listenersRef.current.forEach((listener) => {
        if (listener.module === payload.module) listener.handler(payload);
      });
    });

    // Tells every subscriber (whatever its module) to resync, since pushes
    // sent while the socket was down were never delivered.
    const unsubscribeReconnect = onReconnect(() => {
      listenersRef.current.forEach((listener) => {
        listener.handler({ module: listener.module, type: REALTIME_RECONNECTED, data: null });
      });
    });

    return () => {
      unsubscribe();
      unsubscribeReconnect();
      disconnectSocket();
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((moduleName, handler) => {
    const listener = { module: moduleName, handler };
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  return <ClientRealtimeContext.Provider value={{ subscribe }}>{children}</ClientRealtimeContext.Provider>;
};

export default ClientRealtimeProvider;
