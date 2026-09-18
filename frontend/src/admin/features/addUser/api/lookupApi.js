import { apiRequest } from '../../../../utils/apiClient';

/**
 * companyMaster.isAdminAddingUserFeatureAllowed gates this whole page as a
 * defense-in-depth check - the ADD_USER module assignment (see
 * backend/seeds/seedModuleMaster.js) already keeps the sidebar entry and the
 * Customers page's "Add User" button hidden for vendors without it, but a
 * vendor can have the module assigned while the company-level flag is still off.
 */
export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

/**
 * Countries/states/cities scoped to this vendor's CompanyMaster.allowedCountries,
 * nested country -> states -> cities - same call ProductForm uses (see
 * admin/features/products/api/lookupApi.js) for its own country/state/city
 * pickers. Used here to drive the cascading Country -> State -> City
 * dropdowns instead of free-text fields.
 */
export const getLocationTaxBundle = () => apiRequest('/location-tax-bundle/get-location-tax-bundle');

export default {
  getCompanyMasterData,
  getLocationTaxBundle,
};
