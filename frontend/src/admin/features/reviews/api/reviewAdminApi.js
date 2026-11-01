import { apiRequest } from '../../../../utils/apiClient';

/**
 * Admin Reviews module (backend/routes/reviewRoutes.js, /api/reviews/admin/*).
 * Every route needs the REVIEWS module; editing and approve/reject are also
 * gated by their switches server-side - the list response's `permissions`
 * says which ones are on.
 */

const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

/**
 * @param {{ status?: string, search?: string, rating?: number, fromDate?: string, toDate?: string, sort?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ reviews: Array, counts: Object, permissions: Object, pagination: Object }>}
 */
export const getAdminReviews = (params, { signal } = {}) => apiRequest(`/reviews/admin/list${toQueryString(params)}`, { signal });

/** @returns {Promise<{ review: Object, permissions: Object }>} review includes originalContent + history. */
export const getAdminReviewDetail = (reviewId) => apiRequest(`/reviews/admin/detail/${reviewId}`);

/**
 * Edit (multipart). `approve: true` = "Save & approve".
 * @param {{ reviewId: string, rating?: number, title?: string, comment?: string, removeImageIds?: string[], files?: File[], approve?: boolean }} payload
 */
export const updateAdminReview = ({ files = [], removeImageIds = [], ...fields }) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  removeImageIds.forEach((id) => formData.append('removeImageIds[]', id));
  files.forEach((file) => formData.append('images', file));
  return apiRequest('/reviews/admin/update', { method: 'PUT', body: formData });
};

export const approveReviews = (reviewIds) => apiRequest('/reviews/admin/approve', { method: 'POST', body: { reviewIds } });

/** `reason` is optional and only ever seen by admins. */
export const rejectReviews = (reviewIds, reason) => apiRequest('/reviews/admin/reject', { method: 'POST', body: { reviewIds, reason: reason || '' } });

export const deleteReviews = (reviewIds) => apiRequest('/reviews/admin/bulk-delete', { method: 'POST', body: { reviewIds } });
