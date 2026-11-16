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

/**
 * Checkout can't offer any way to pay (Cash on Delivery off and the bank
 * details could not be loaded / aren't set up): emails the platform owner.
 * The customer's own details are taken from their account on the server.
 * @param {{ reason: 'OPTIONS_FAILED'|'NO_PAYMENT_OPTION', errorMessage?: string, cartTotal?: string, itemCount?: number, pageUrl?: string }} report
 */
export const reportCheckoutIssue = (report) => apiRequest('/payments/report-checkout-issue', { method: 'POST', body: report });

export default { getPaymentOptions, selectCashOnDelivery, selectManualTransfer, reportCheckoutIssue };
