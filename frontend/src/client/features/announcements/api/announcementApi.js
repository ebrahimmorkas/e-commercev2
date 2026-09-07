import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) read of the current vendor's active
 * announcements. Vendor is resolved server-side from the request domain
 * (see backend/middlewares/vendorDetection.js) - no token needed.
 */
export const getStorefrontAnnouncements = () =>
  apiRequest('/announcements/get-all-announcement', { auth: false });

export default { getStorefrontAnnouncements };
