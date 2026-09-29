import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront (public, unauthenticated) read of the current vendor's
 * CompanySettings - server-side filtered to a public-safe subset (company
 * identity, policies, show/hide toggles) - see
 * PUBLIC_COMPANY_SETTINGS_FIELDS in backend/controllers/companySettingsController.js.
 * Vendor is resolved server-side from the request domain (see
 * backend/middlewares/vendorDetection.js) - no token needed, same convention
 * as the other storefront api modules under client/features/*.
 */
export const getStorefrontCompanySettings = () =>
  apiRequest('/company-settings/get-company-settings', { auth: false });

// Public link to the vendor's catalogue PDF; the server answers with a
// download (Content-Disposition: attachment), so a plain link is enough.
export const CATALOGUE_DOWNLOAD_URL = `${import.meta.env.VITE_API_BASE_URL || '/api'}/company-settings/catalogue/download`;

export default { getStorefrontCompanySettings, CATALOGUE_DOWNLOAD_URL };
