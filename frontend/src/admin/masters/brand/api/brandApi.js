import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/brands';

/**
 * Fetches all (active + inactive, non-deleted) brands for the current
 * vendor, admin view.
 */
export const getAllBrandsAdmin = () => apiRequest(`${BASE}/get-all-brands-admin`);

/**
 * @param {Object} data - { brandName, brandShortName }
 */
export const addBrand = (data) => apiRequest(`${BASE}/add-brand`, { method: 'POST', body: data });

/**
 * @param {Object} data - { brandId, ...fields to update }
 */
export const updateBrand = (data) => apiRequest(`${BASE}/update-brand`, { method: 'PUT', body: data });

/**
 * @param {string} brandId
 */
export const deleteBrand = (brandId) =>
  apiRequest(`${BASE}/delete-brand`, { method: 'DELETE', body: { brandId } });

export default {
  getAllBrandsAdmin,
  addBrand,
  updateBrand,
  deleteBrand,
};
