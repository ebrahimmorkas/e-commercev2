import { useCallback, useEffect, useRef } from 'react';
import { RealtimeContext } from './RealtimeContext';
import { useAuth } from '../features/login/hooks/useAuth';
import { connectSocket, disconnectSocket, onNotification } from '../../utils/socketClient';

/**
 * Owns the ONE shared socket.io connection for the whole admin app - connects
 * once the admin session is authenticated, disconnects on logout. Any feature
 * (Abandoned Cart today, more later) subscribes to its own `module` via
 * useRealtime().subscribe(...) instead of touching the socket directly, so
 * adding a new realtime module never means opening a second connection.
 */
const RealtimeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const listenersRef = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return undefined;
    }

    connectSocket();
    const unsubscribe = onNotification((payload) => {
      listenersRef.current.forEach((listener) => {
        if (listener.module === payload.module) listener.handler(payload);
      });
    });

    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((moduleName, handler) => {
    const listener = { module: moduleName, handler };
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  return <RealtimeContext.Provider value={{ subscribe }}>{children}</RealtimeContext.Provider>;
};

export default RealtimeProvider;
