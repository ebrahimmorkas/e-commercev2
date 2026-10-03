import { apiRequest } from '../../../../utils/apiClient';
import { getStorefrontCategories } from '../../categories/api/categoryApi';

/**
 * Storefront (public, unauthenticated) product reads.
 * Vendor is resolved server-side from the request domain (see
 * backend/middlewares/vendorDetection.js) - no token needed.
 *
 * Every list is paginated server-side (backend productService.fetchProductPage)
 * and returns { products, pagination: { page, limit, total, totalPages, hasMore } }.
 */

// { page, limit, sort, q } -> "?page=2&limit=24..." (empty values left out).
const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

/** @param {{ page?: number, limit?: number, sort?: string, q?: string }} [params] */
export const getStorefrontProducts = (params) =>
  apiRequest(`/products/get-products${toQueryString(params)}`, { auth: false });

// Specific products, in the order given (a product's recommendations).
export const getStorefrontProductsByIds = (ids) =>
  apiRequest(`/products/get-products${toQueryString({ ids: ids.join(',') })}`, { auth: false });

export const getStorefrontProductById = (id) =>
  apiRequest(`/products/get-product/${id}`, { auth: false });

// categoryId can be a main or sub-category id - the backend also includes
// that category's active descendants (see productService.js
// fetchProductsByCategoryForClient), so a parent category returns its
// children's products too. The response also carries `categoryName`.
export const getStorefrontProductsByCategory = (categoryId, params) =>
  apiRequest(`/products/get-products-by-category/${categoryId}${toQueryString(params)}`, { auth: false });

// brandId is the encoded id from the brands list. Also carries `brandName`.
export const getStorefrontProductsByBrand = (brandId, params) =>
  apiRequest(`/products/get-products-by-brand/${brandId}${toQueryString(params)}`, { auth: false });

// Re-exported from features/categories - the Navbar's Shop mega-menu also
// needs this list, so the endpoint call lives in one place.
export { getStorefrontCategories };

export default {
  getStorefrontProducts,
  getStorefrontProductsByIds,
  getStorefrontProductById,
  getStorefrontProductsByCategory,
  getStorefrontProductsByBrand,
  getStorefrontCategories,
};
