import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/auth';

/**
 * @param {Object} data - { name, username, email, phone_no, whatsapp_no, password }
 */
export const register = (data) =>
  apiRequest(`${BASE}/register`, { method: 'POST', body: data, auth: false });

/**
 * @param {string} identifier - username, email, or phone number
 * @param {string} password
 * @returns {Promise<{ user: Object, accessToken: string }>}
 */
export const login = (identifier, password) =>
  apiRequest(`${BASE}/login`, { method: 'POST', body: { identifier, password }, auth: false });

/**
 * Exchanges the httpOnly refresh-token cookie for a new access token.
 * @returns {Promise<{ accessToken: string }>}
 */
export const refreshToken = () => apiRequest(`${BASE}/refresh-token`, { method: 'POST', auth: false });

export const logout = () => apiRequest(`${BASE}/logout`, { method: 'POST', auth: false });

export const logoutAll = () => apiRequest(`${BASE}/logout-all`, { method: 'POST', auth: false });

export default { register, login, refreshToken, logout, logoutAll };
