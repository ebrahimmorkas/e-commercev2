import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/couriers';

/**
 * All (active + inactive, non-deleted) couriers for the current vendor, plus
 * the vendor's courier quota.
 * @returns {Promise<{ couriers: Object[], numberOfCouriersAllowed: number|null }>}
 */
export const getAllCouriersAdmin = () => apiRequest(`${BASE}/get-all-couriers-admin`);

/**
 * Only active couriers - for the order modal's courier dropdown.
 * @returns {Promise<{ _id: string, courierName: string }[]>}
 */
export const getActiveCouriers = () => apiRequest(`${BASE}/get-active-couriers`);

/**
 * @param {Object} data - { courierName }
 */
export const addCourier = (data) => apiRequest(`${BASE}/add-courier`, { method: 'POST', body: data });

/**
 * @param {Object} data - { courierId, ...fields to update (courierName, status) }
 */
export const updateCourier = (data) => apiRequest(`${BASE}/update-courier`, { method: 'PUT', body: data });

/**
 * @param {string} courierId
 */
export const deleteCourier = (courierId) =>
  apiRequest(`${BASE}/delete-courier`, { method: 'DELETE', body: { courierId } });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount }.
export const bulkSetCourierStatus = (courierIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { courierIds, status } });

export const bulkDeleteCouriers = (courierIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { courierIds } });

export default {
  getAllCouriersAdmin,
  getActiveCouriers,
  addCourier,
  updateCourier,
  deleteCourier,
  bulkSetCourierStatus,
  bulkDeleteCouriers,
};
