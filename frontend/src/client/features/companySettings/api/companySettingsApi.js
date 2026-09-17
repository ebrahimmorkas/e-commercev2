import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) read of the current vendor's
 * CompanySettings show/hide toggles (showAnnouncements, showBanners, ...).
 * Vendor is resolved server-side from the request domain (see
 * backend/middlewares/vendorDetection.js) - no token needed, same convention
 * as the other storefront api modules under client/features/*.
 */
export const getStorefrontCompanySettings = () =>
  apiRequest('/company-settings/get-company-settings', { auth: false });

export default { getStorefrontCompanySettings };
