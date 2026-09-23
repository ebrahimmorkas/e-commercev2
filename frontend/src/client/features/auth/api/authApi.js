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
 *   plus, only when the vendor has tax registration on and the customer ticked it:
 *   { isTaxRegistered: true, businessFullName, trn }
 */
export const register = (data) => apiRequest('/auth/register', { method: 'POST', body: data, auth: false });

/**
 * Public - tells the register form whether to offer the "I am tax registered"
 * checkbox (a vendor's own Company Settings choice).
 * @returns {Promise<{ taxRegistrationEnabled: boolean }>}
 */
export const getRegistrationConfig = () => apiRequest('/auth/registration-config', { auth: false });

/**
 * Public - the countries this store serves, with their states and cities, for
 * the signup Country/State/City dropdowns (same bundle the admin forms use).
 * @returns {Promise<{ countries: Array, states: Array, cities: Array }>}
 */
export const getSignupLocations = () => apiRequest('/location-tax-bundle/get-location-tax-bundle', { auth: false });

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

export default { register, getRegistrationConfig, getSignupLocations, login, refreshToken, logout };
