import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) blog reads. The vendor is resolved
 * server-side from the request domain. Only published posts are returned;
 * the list leaves out each post's body.
 *
 * @param {{ page?: number, limit?: number, search?: string, category?: string }} params
 * @returns {Promise<{ blogs: Array, total: number, hasMore: boolean, categories: Array<{name: string, count: number}> }>}
 */
export const getStorefrontBlogs = ({ page = 1, limit = 9, search = '', category = '' } = {}) => {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  return apiRequest(`/blogs/get-blogs?${query.toString()}`, { auth: false });
};

/** @returns {Promise<{ blog: Object, related: Array }>} */
export const getStorefrontBlogPost = (slug) => apiRequest(`/blogs/get-blog/${encodeURIComponent(slug)}`, { auth: false });

export default { getStorefrontBlogs, getStorefrontBlogPost };
