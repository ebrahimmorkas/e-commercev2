import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeContext } from './RealtimeContext';
import { useAuth } from '../features/login/hooks/useAuth';
import {
  connectSocket,
  disconnectSocket,
  onNotification,
  onUserNotification,
  onReconnect,
  onConnectionStatusChange,
  reconnectSocket,
  startAutoReconnect,
  CONNECTION_STATUS,
  REALTIME_RECONNECTED,
} from '../../utils/socketClient';
import { renewAccessToken } from '../../utils/apiClient';

/**
 * Owns the ONE shared socket.io connection for the whole admin app - connects
 * once the admin session is authenticated, disconnects on logout. Any feature
 * (Abandoned Cart, Orders, ...) subscribes to its own `module` via
 * useRealtime().subscribe(...) instead of touching the socket directly, so
 * adding a new realtime module never means opening a second connection.
 * Also exposes the connection `status` (for a "Live" indicator) and a manual
 * `reconnect()` for when the socket has given up on its own.
 */
const RealtimeProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  // Admins listen on the store's admin channel; a delivery agent on their own
  // private channel (the server only ever sends them their own orders).
  const channel = !isAuthenticated ? null : user?.role === 'admin' ? 'admin' : user?.role === 'deliveryAgent' ? 'agent' : null;
  const listenersRef = useRef(new Set());
  const [status, setStatus] = useState(CONNECTION_STATUS.CONNECTING);

  useEffect(() => {
    if (!channel) {
      disconnectSocket();
      return undefined;
    }

    connectSocket();
    const listen = channel === 'agent' ? onUserNotification : onNotification;
    const unsubscribe = listen((payload) => {
      listenersRef.current.forEach((listener) => {
        if (listener.module === payload.module) listener.handler(payload);
      });
    });

    // Tells every subscriber (whatever its module) to resync, since pushes
    // sent while the socket was down were never delivered.
    const resyncAll = () => {
      listenersRef.current.forEach((listener) => {
        listener.handler({ module: listener.module, type: REALTIME_RECONNECTED, data: null });
      });
    };
    const unsubscribeReconnect = onReconnect(resyncAll);

    const unsubscribeStatus = onConnectionStatusChange(setStatus);
    // No Refresh button needed: a socket that gave up comes back by itself.
    const stopAutoReconnect = startAutoReconnect(renewAccessToken, resyncAll);

    return () => {
      unsubscribe();
      unsubscribeReconnect();
      unsubscribeStatus();
      stopAutoReconnect();
      disconnectSocket();
    };
  }, [channel]);

  const subscribe = useCallback((moduleName, handler) => {
    const listener = { module: moduleName, handler };
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  // Only does anything when the socket has given up (OFFLINE). Callers should
  // run it after an API call has had the chance to refresh the access token.
  const reconnect = useCallback(() => {
    if (reconnectSocket()) setStatus(CONNECTION_STATUS.CONNECTING);
  }, []);

  const value = useMemo(() => ({ subscribe, status, reconnect }), [subscribe, status, reconnect]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export default RealtimeProvider;
