import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront product reviews (backend/routes/reviewRoutes.js, mounted at
 * /api/reviews). Reading is public; writing needs a logged-in customer.
 * Every id here (product, order, review) is the encoded id the API hands out.
 */

const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

/** Whether reviews / review photos are on for this store, and the photo limits. */
export const getReviewSettings = () => apiRequest('/reviews/settings', { auth: false });

/**
 * @param {string} productId
 * @param {{ page?: number, limit?: number, sort?: string, rating?: number }} [params]
 * @returns {Promise<{ summary: Object, reviews: Array, pagination: Object }>}
 */
export const getProductReviews = (productId, params, { signal } = {}) =>
  apiRequest(`/reviews/product/${productId}${toQueryString(params)}`, { auth: false, signal });

/** Can the logged-in customer review this product, and with which delivered order? */
export const getMyProductReviewStatus = (productId) => apiRequest(`/reviews/product/${productId}/my-status`);

/** The logged-in customer's reviews for the products on one of their orders. */
export const getMyOrderReviewStatus = (orderId) => apiRequest(`/reviews/my-order/${orderId}`);

// Text fields + photos as one multipart form (the backend's `images` files).
const buildReviewFormData = (fields, files = [], removeImageIds = []) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  removeImageIds.forEach((id) => formData.append('removeImageIds[]', id));
  files.forEach((file) => formData.append('images', file));
  return formData;
};

/** @param {{ productId: string, orderId: string, rating: number, title?: string, comment?: string, files?: File[] }} payload */
export const createReview = ({ files = [], ...fields }) =>
  apiRequest('/reviews', { method: 'POST', body: buildReviewFormData(fields, files) });

/** @param {{ reviewId: string, rating?: number, title?: string, comment?: string, files?: File[], removeImageIds?: string[] }} payload */
export const updateReview = ({ files = [], removeImageIds = [], ...fields }) =>
  apiRequest('/reviews', { method: 'PUT', body: buildReviewFormData(fields, files, removeImageIds) });

export const deleteReview = (reviewId) => apiRequest('/reviews', { method: 'DELETE', body: { reviewId } });

export default {
  getReviewSettings,
  getProductReviews,
  getMyProductReviewStatus,
  getMyOrderReviewStatus,
  createReview,
  updateReview,
  deleteReview,
};
