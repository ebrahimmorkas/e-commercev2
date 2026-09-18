import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/banners';

/**
 * Fetches all (active + inactive) banners for the current vendor, admin view.
 */
export const getAllBannersAdmin = () => apiRequest(`${BASE}/get-all-banner-admin`);

/**
 * @param {string} bannerId
 */
export const getBannerById = (bannerId) => apiRequest(`${BASE}/get-banner/${bannerId}`);

/**
 * @param {Object} fields - { name, startDate, endDate, precedence }
 * @param {Object} media - { image?: File, video?: File } - exactly one of the two
 */
export const addBanner = (fields, media = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (media.image) formData.append('image', media.image);
  if (media.video) formData.append('video', media.video);

  return apiRequest(`${BASE}/add-banner`, { method: 'POST', body: formData });
};

/**
 * @param {string} bannerId
 * @param {Object} fields - { name, status, startDate, endDate, isDefault, precedence }
 * @param {Object} media - { image?: File, video?: File } - at most one of the two (replaces the banner's media, may switch type)
 */
export const updateBanner = (bannerId, fields, media = {}) => {
  const formData = new FormData();
  formData.append('bannerId', bannerId);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (media.image) formData.append('image', media.image);
  if (media.video) formData.append('video', media.video);

  return apiRequest(`${BASE}/update-banner`, { method: 'PUT', body: formData });
};

/**
 * @param {string} bannerId
 */
export const deleteBanner = (bannerId) =>
  apiRequest(`${BASE}/delete-banner`, { method: 'DELETE', body: { bannerId } });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// Both return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation.
export const bulkSetBannerStatus = (bannerIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { bannerIds, status } });

export const bulkDeleteBanners = (bannerIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { bannerIds } });

export default {
  getAllBannersAdmin,
  getBannerById,
  addBanner,
  updateBanner,
  deleteBanner,
  bulkSetBannerStatus,
  bulkDeleteBanners,
};
