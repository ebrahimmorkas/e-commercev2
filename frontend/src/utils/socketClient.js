/**
 * Generic socket.io connection manager - one shared connection per admin
 * session, reused by every module's realtime feature (Abandoned Cart today,
 * more later). Not feature-specific: nothing here knows about carts.
 *
 * Auth mirrors apiClient.js: the in-memory access token is read fresh on
 * every (re)connect attempt via a callback, since socket.io-client supports
 * `auth` as a function - so a token minted by AuthProvider after this module
 * loaded is still picked up without recreating the socket.
 */
import { io } from 'socket.io-client';
import { getAccessToken } from './apiClient';

// Must match backend's REALTIME_NOTIFICATION_EVENT (constants/abandonedCartConstants.js).
// One shared event name for every module - each payload carries its own `module` field.
export const REALTIME_NOTIFICATION_EVENT = 'admin:notification';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
// socket.io connects to an origin, not a REST path - strip a trailing /api
// (dev: proxied by vite.config.js same as REST calls; prod: same origin as
// the page, same reasoning as apiClient's credentials:'include' comment).
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;

let socket = null;

export const connectSocket = () => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    autoConnect: true,
    withCredentials: true,
    auth: (cb) => cb({ token: getAccessToken() }),
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

/**
 * Subscribe to the shared notification channel.
 * @param {(payload: { module: string, type: string, data: any }) => void} handler
 * @returns {() => void} unsubscribe
 */
export const onNotification = (handler) => {
  const activeSocket = connectSocket();
  activeSocket.on(REALTIME_NOTIFICATION_EVENT, handler);
  return () => activeSocket.off(REALTIME_NOTIFICATION_EVENT, handler);
};
