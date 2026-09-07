import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) category read. Vendor is resolved
 * server-side from the request domain (see backend/middlewares/vendorDetection.js)
 * - no token needed. Returns a flat, active-only list - each item carries its
 * own parent_category_id, so nesting is built client-side (see utils/buildCategoryTree.js).
 */
export const getStorefrontCategories = () =>
  apiRequest('/category/get-categories', { auth: false });

export default { getStorefrontCategories };
