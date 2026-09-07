import { apiRequest } from '../../../../utils/apiClient';
import { getStorefrontCategories } from '../../categories/api/categoryApi';

/**
 * Storefront (public, unauthenticated) product reads.
 * Vendor is resolved server-side from the request domain (see
 * backend/middlewares/vendorDetection.js) - no token needed.
 */

export const getStorefrontProducts = () =>
  apiRequest('/products/get-products', { auth: false });

export const getStorefrontProductById = (id) =>
  apiRequest(`/products/get-product/${id}`, { auth: false });

// Re-exported from features/categories - the Navbar's Shop mega-menu also
// needs this list, so the endpoint call lives in one place.
export { getStorefrontCategories };

export default {
  getStorefrontProducts,
  getStorefrontProductById,
  getStorefrontCategories,
};
