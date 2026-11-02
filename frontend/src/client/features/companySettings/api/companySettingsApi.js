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

// Public link to the vendor's catalogue PDF.
export const CATALOGUE_DOWNLOAD_URL = `${import.meta.env.VITE_API_BASE_URL || '/api'}/company-settings/catalogue/download`;

/**
 * Fetches the catalogue and saves it. A plain `<a download>` would save the
 * server's JSON error (e.g. 404 when the file is gone) as "download.json", so
 * the response is checked first. Returns true when a PDF was saved.
 */
export const downloadCatalogue = async () => {
  const response = await fetch(CATALOGUE_DOWNLOAD_URL);
  if (!response.ok || !(response.headers.get('content-type') || '').includes('application/pdf')) {
    return false;
  }
  const match = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') || '');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : 'catalogue.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
};

export default { getStorefrontCompanySettings, CATALOGUE_DOWNLOAD_URL, downloadCatalogue };
