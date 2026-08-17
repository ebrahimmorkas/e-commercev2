/**
 * Shared fetch-based API client.
 * Centralizes the base URL, auth header attachment, refresh-on-401 retry,
 * and response/error normalization so every feature's api/ module can stay
 * a thin wrapper.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// In-memory only - never persisted to localStorage/sessionStorage, so it can't be
// read by injected scripts or extensions after the fact. Lost on reload by design;
// AuthProvider re-mints it from the httpOnly refresh-token cookie on mount.
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };

/**
 * A normalized error thrown for any non-success API response.
 * Carries the HTTP status and any field-level `errors` array the backend sent.
 */
export class ApiError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// Endpoints that must never trigger a refresh-and-retry: refreshing on a failed
// login/register makes no sense (there's no session yet), and retrying the
// refresh call itself on its own 401 would loop forever.
const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/refresh-token', '/auth/logout'];

// Notified when a refresh attempt fails, i.e. the session is truly over.
// AuthContext subscribes to this to clear its user state and show the login screen.
let sessionExpiredHandler = null;
export const onSessionExpired = (handler) => {
  sessionExpiredHandler = handler;
};

// Dedupe concurrent refresh attempts: if several requests 401 at once, only one
// refresh call goes out and every caller awaits the same in-flight promise.
let refreshPromise = null;

const performRefresh = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) return null;
        return payload.data?.accessToken || null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

/**
 * @param {string} path - Path relative to the API base URL, e.g. '/announcements/add-announcement'
 * @param {Object} options
 * @param {string} options.method - HTTP method (default 'GET')
 * @param {Object} options.body - Request body, JSON-serialized automatically
 * @param {boolean} options.auth - Attach the Authorization: Bearer header (default true)
 * @param {Object} options.headers - Additional headers
 */
export const apiRequest = async (path, { method = 'GET', body, auth = true, headers = {}, _isRetry = false } = {}) => {
  // FormData (file uploads) must NOT get a JSON Content-Type or be stringified -
  // the browser needs to set its own multipart/form-data boundary.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...headers };

  if (auth) {
    const token = getAccessToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      credentials: 'include',
      body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection.', 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response body; fall through with payload = null
  }

  const isAuthExempt = AUTH_EXEMPT_PATHS.some((exempt) => path.startsWith(exempt));

  if (response.status === 401 && auth && !_isRetry && !isAuthExempt) {
    const newToken = await performRefresh();
    if (newToken) {
      setAccessToken(newToken);
      return apiRequest(path, { method, body, auth, headers, _isRetry: true });
    }
    clearAccessToken();
    sessionExpiredHandler?.();
  }

  if (!response.ok || !payload?.success) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload?.errors || null);
  }

  return payload.data;
};

export default apiRequest;
