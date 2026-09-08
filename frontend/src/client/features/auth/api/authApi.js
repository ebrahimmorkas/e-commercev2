import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront customer auth. Same /api/auth/* endpoints the admin panel uses
 * (backend/controllers/authController.js is role-agnostic - it just resolves
 * whichever user matches the identifier for this vendor), kept as a separate
 * copy here rather than importing admin/features/login/api/authApi.js so the
 * client app never reaches into the admin feature folder.
 */

/**
 * @param {Object} data - { name, username, email, phone_no, whatsapp_no, password, country, state, city }
 */
export const register = (data) => apiRequest('/auth/register', { method: 'POST', body: data, auth: false });

/**
 * @param {string} identifier - username, email, or phone number
 * @param {string} password
 * @returns {Promise<{ user: Object, accessToken: string }>}
 */
export const login = (identifier, password) =>
  apiRequest('/auth/login', { method: 'POST', body: { identifier, password }, auth: false });

/**
 * Exchanges the httpOnly refresh-token cookie for a new access token.
 * @returns {Promise<{ accessToken: string, user: Object }>}
 */
export const refreshToken = () => apiRequest('/auth/refresh-token', { method: 'POST', auth: false });

export const logout = () => apiRequest('/auth/logout', { method: 'POST', auth: false });

export default { register, login, refreshToken, logout };
