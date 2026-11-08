import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/blogs';

/**
 * @param {Object} params - { page, limit, search, status }
 * @returns {Promise<{ blogs: Array, total: number, page: number, hasMore: boolean }>}
 */
export const getAllBlogsAdmin = ({ page = 1, limit = 50, search = '', status = '' } = {}) => {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  return apiRequest(`${BASE}/get-all-blogs-admin?${query.toString()}`);
};

/** The full post (including its HTML body) - the list endpoint leaves the body out. */
export const getBlogByIdAdmin = (blogId) => apiRequest(`${BASE}/get-blog-admin/${blogId}`);

const toFormData = (fields, coverImage, extra = {}) => {
  const formData = new FormData();
  Object.entries({ ...extra, ...fields }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (coverImage) formData.append('coverImage', coverImage);
  return formData;
};

export const addBlog = (fields, coverImage) =>
  apiRequest(`${BASE}/add-blog`, { method: 'POST', body: toFormData(fields, coverImage) });

export const updateBlog = (blogId, fields, coverImage) =>
  apiRequest(`${BASE}/update-blog`, { method: 'PUT', body: toFormData(fields, coverImage, { blogId }) });

export const deleteBlog = (blogId) => apiRequest(`${BASE}/delete-blog`, { method: 'DELETE', body: { blogId } });

export const bulkSetBlogStatus = (blogIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { blogIds, status } });

export const bulkDeleteBlogs = (blogIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { blogIds } });
