import { useContext } from 'react';
import { RealtimeContext } from './RealtimeContext';

/**
 * Hook for any admin feature to subscribe to its own realtime notifications
 * without knowing about socket.io at all.
 *
 * Usage:
 *   const { subscribe } = useRealtime();
 *   useEffect(() => subscribe('ABANDONED_CART', (payload) => { ... }), [subscribe]);
 */
export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);

  if (!ctx) {
    throw new Error('useRealtime must be used within a <RealtimeProvider>');
  }

  return ctx;
};

export default useRealtime;
