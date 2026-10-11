import { apiRequest } from './apiClient';

// Mirrors STORE_STATUS in backend/constants/storeAvailabilityConstants.js.
export const STORE_STATUS = {
  MAINTENANCE: 'MAINTENANCE',
  PLAN_EXPIRED: 'PLAN_EXPIRED',
};

/**
 * Whether the current vendor's store is open. Public - the vendor is resolved
 * server-side from the domain, and this endpoint keeps answering while every
 * other one is refused.
 *
 * @returns {Promise<{ status: string|null, store: { companyName, companyLogoUrl, contactEmail, contactPhoneNumber } }>}
 *   `status` is null while the store is open.
 */
export const getStoreStatus = () => apiRequest('/store-status', { auth: false });

export default getStoreStatus;
