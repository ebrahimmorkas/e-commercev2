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
 * @returns {Promise<{ accessToken: string, user: Object }>}
 */
export const refreshToken = () => apiRequest(`${BASE}/refresh-token`, { method: 'POST', auth: false });

export const logout = () => apiRequest(`${BASE}/logout`, { method: 'POST', auth: false });

export const logoutAll = () => apiRequest(`${BASE}/logout-all`, { method: 'POST', auth: false });

/**
 * Public - whether this store offers "Forgot password?" (isForgotPasswordFunctionalityOn
 * plus a working email account), and the code's length/expiry/resend wait.
 * @returns {Promise<{ forgotPasswordEnabled: boolean, otpLength: number, otpExpiryMinutes: number, resendCooldownSeconds: number }>}
 */
export const getForgotPasswordConfig = () => apiRequest(`${BASE}/forgot-password/config`, { auth: false });

/**
 * Emails a reset code. Succeeds the same way whether or not the email has an account.
 * @param {string} email
 * @returns {Promise<{ otpExpiryMinutes: number, resendCooldownSeconds: number }>}
 */
export const requestPasswordResetOtp = (email) =>
  apiRequest(`${BASE}/forgot-password/request-otp`, { method: 'POST', body: { email }, auth: false });

/**
 * @param {Object} data - { email, otp, newPassword, confirmPassword }
 */
export const resetPassword = (data) =>
  apiRequest(`${BASE}/forgot-password/reset`, { method: 'POST', body: data, auth: false });

export default {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getForgotPasswordConfig,
  requestPasswordResetOtp,
  resetPassword,
};
