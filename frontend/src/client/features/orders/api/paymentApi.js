import { apiRequest } from '../../../../utils/apiClient';

/**
 * Checkout payment choices (backend/routes/paymentRoutes.js). Customer routes -
 * they need a logged-in user.
 */

/**
 * What this store offers at checkout. Everything comes from Company Settings
 * (and the feature flags above it).
 * @returns {Promise<{ cod: boolean, online: null | { scannerUrl: string|null, bank: Object|null, gpayNumber: string|null, whatsappNumber: string|null, companyName: string|null } }>}
 */
export const getPaymentOptions = () => apiRequest('/payments/options');

/** Records Cash on Delivery on a placed order. @param {string} orderId */
export const selectCashOnDelivery = (orderId) => apiRequest(`/payments/${orderId}/cod`, { method: 'POST' });

/** Records "pay online by QR / bank transfer" on a placed order. @param {string} orderId */
export const selectManualTransfer = (orderId) => apiRequest(`/payments/${orderId}/manual-transfer`, { method: 'POST' });

export default { getPaymentOptions, selectCashOnDelivery, selectManualTransfer };
