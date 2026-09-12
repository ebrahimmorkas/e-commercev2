import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) brand read. Vendor is resolved
 * server-side from the request domain - no token needed. Returns only
 * active brands, projected to { _id, brandName, brandShortName }.
 */
export const getStorefrontBrands = () => apiRequest('/brands/get-all-brands', { auth: false });

export default { getStorefrontBrands };
