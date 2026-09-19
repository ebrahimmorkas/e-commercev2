import { useContext } from 'react';
import { ClientRealtimeContext } from './ClientRealtimeContext';

/**
 * Hook for any storefront feature to subscribe to its own realtime
 * notifications without knowing about socket.io at all.
 *
 * Usage:
 *   const { subscribe } = useClientRealtime();
 *   useEffect(() => subscribe('ORDERS', (payload) => { ... }), [subscribe]);
 */
export const useClientRealtime = () => {
  const ctx = useContext(ClientRealtimeContext);

  if (!ctx) {
    throw new Error('useClientRealtime must be used within a <ClientRealtimeProvider>');
  }

  return ctx;
};

export default useClientRealtime;
