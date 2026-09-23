import { apiRequest } from '../../../../utils/apiClient';

/**
 * CompanyMaster entitlement flags this page needs - whether the Bank
 * Transfer group (showPaymentQRCodeAndBankDetails) and the Partner
 * Certificate upload (isShowingPartnerCertificateFeatureOn) should be shown
 * at all, and (Shipping tab) isShippingPriceFeatureOn / allowedShippingPriceMethods /
 * allowedWeights. Same "only the CompanyMaster half of the gate, not WebsiteMaster's"
 * limitation already accepted in banners/api/lookupApi.js - the real
 * entitlement check still happens server-side on save.
 */
export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

/** Lookups the Shipping tab's rule pickers need (categories, weight units, countries/states/cities). */
export const getAdminCategories = () => apiRequest('/category/get-admin-categories');

export const getWeights = () => apiRequest('/weights/get-weights');

export const getLocationTaxBundle = () => apiRequest('/location-tax-bundle/get-location-tax-bundle');

/** Every active currency, for the Store Currency dropdown - { currencies: [{ _id, code, name, symbol }] }. */
export const getCurrencies = () => apiRequest('/currency/currencies');

export default {
  getCompanyMasterData,
  getAdminCategories,
  getWeights,
  getLocationTaxBundle,
  getCurrencies,
};
