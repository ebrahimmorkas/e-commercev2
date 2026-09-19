import { createContext } from 'react';

/**
 * @type {import('react').Context<{
 *   subscribe: (module: string, handler: (payload: { module: string, type: string, data: any }) => void) => () => void,
 *   status: 'connected' | 'connecting' | 'offline',
 *   reconnect: () => void
 * } | null>}
 */
export const RealtimeContext = createContext(null);
