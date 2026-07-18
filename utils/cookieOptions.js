const isProduction = process.env.NODE_ENV === 'production';

/**
 * NOTE: Your frontend (localhost:3000) and backend (localhost:5000) are on different
 * ports, which browsers treat as different origins. For the refresh-token cookie to be
 * sent on cross-origin fetch/XHR requests (not just top-level navigation), it technically
 * needs `sameSite: 'none'` + `secure: true`, which requires HTTPS - not available on
 * localhost/http.
 *
 * The common workaround used in dev is `sameSite: 'lax'` over plain http, which works
 * fine for same-site or proxied setups but will NOT be sent by the browser on a raw
 * cross-port fetch call. If you hit an issue where the refresh cookie isn't arriving in
 * dev, either:
 *   1) Proxy frontend API calls through the backend's origin (e.g. CRA "proxy" field), OR
 *   2) Run both under the same origin via a reverse proxy in dev, OR
 *   3) Use HTTPS locally (mkcert) and set sameSite: 'none', secure: true even in dev.
 * Flagging this now so it isn't a surprise later - happy to wire up whichever option you prefer.
 */

const accessTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
};

const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth' // only sent to auth routes, reduces exposure
};

module.exports = {
    accessTokenCookieOptions,
    refreshTokenCookieOptions
};