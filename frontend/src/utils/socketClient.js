/**
 * Generic socket.io connection manager - one shared connection per session
 * (admin panel or storefront customer - never both in one page load, see
 * main.jsx), reused by every module's realtime feature (Abandoned Cart and
 * Orders today, more later). Not feature-specific: nothing here knows about
 * carts or orders.
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

// Customer-facing counterpart, delivered only to the logged-in customer's own
// private room. Must match backend's REALTIME_USER_NOTIFICATION_EVENT
// (constants/realtimeConstants.js). Same payload shape as the admin channel.
export const REALTIME_USER_NOTIFICATION_EVENT = 'user:notification';

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

/**
 * Subscribe to the customer channel (storefront sessions).
 * @param {(payload: { module: string, type: string, data: any }) => void} handler
 * @returns {() => void} unsubscribe
 */
export const onUserNotification = (handler) => {
  const activeSocket = connectSocket();
  activeSocket.on(REALTIME_USER_NOTIFICATION_EVENT, handler);
  return () => activeSocket.off(REALTIME_USER_NOTIFICATION_EVENT, handler);
};

// Pseudo notification type broadcast to every subscriber after the socket
// re-establishes a dropped connection (backend restart, network blip). Pushes
// sent while it was down are gone for good, so a feature that shows live data
// should refetch over REST when it sees this.
export const REALTIME_RECONNECTED = 'RECONNECTED';

export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  // Handshaking, or dropped and socket.io is retrying by itself.
  CONNECTING: 'connecting',
  // Down and NOT retrying on its own - e.g. the server rejected the handshake
  // (expired access token) or disconnected us deliberately. Needs a manual
  // reconnect - see reconnectSocket().
  OFFLINE: 'offline',
};

// `socket.active` is true while socket.io will keep (re)connecting by itself,
// and false once it has given up - it's cleared BEFORE the connect_error /
// disconnect event fires for those cases, so it's safe to read from inside
// the handlers below.
const connectionStatusOf = (activeSocket) => {
  if (activeSocket.connected) return CONNECTION_STATUS.CONNECTED;
  return activeSocket.active ? CONNECTION_STATUS.CONNECTING : CONNECTION_STATUS.OFFLINE;
};

/**
 * Reports the socket's connection status now and on every change.
 * @param {(status: string) => void} handler - receives a CONNECTION_STATUS value
 * @returns {() => void} unsubscribe
 */
export const onConnectionStatusChange = (handler) => {
  const activeSocket = connectSocket();
  const report = () => handler(connectionStatusOf(activeSocket));

  activeSocket.on('connect', report);
  activeSocket.on('disconnect', report);
  activeSocket.on('connect_error', report);
  // A retry flips a previously-failed socket back to "connecting".
  activeSocket.io.on('reconnect_attempt', report);
  report();

  return () => {
    activeSocket.off('connect', report);
    activeSocket.off('disconnect', report);
    activeSocket.off('connect_error', report);
    activeSocket.io.off('reconnect_attempt', report);
  };
};

/**
 * Manually re-opens a socket that gave up (status OFFLINE). Does nothing while
 * it's connected or still retrying by itself. The auth callback re-reads the
 * in-memory access token, so call this AFTER something has refreshed it (any
 * API call that 401s does).
 * @returns {boolean} whether a reconnect was actually started
 */
export const reconnectSocket = () => {
  if (!socket || socket.connected || socket.active) return false;
  socket.connect();
  return true;
};

/**
 * Fires after a successful RE-connection only - not the first connect.
 * @param {() => void} handler
 * @returns {() => void} unsubscribe
 */
export const onReconnect = (handler) => {
  const activeSocket = connectSocket();
  // `reconnect` is emitted by the socket.io Manager, not the socket itself.
  activeSocket.io.on('reconnect', handler);
  return () => activeSocket.io.off('reconnect', handler);
};
