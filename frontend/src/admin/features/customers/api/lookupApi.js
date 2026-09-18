import { apiRequest } from '../../../../utils/apiClient';

/**
 * companyMaster.isAdminAddingUserFeatureAllowed / isPasswordChangeFeatureByAdminAllowed
 * drive whether the Add User / Change Password actions show up for this
 * vendor - see admin/features/products/api/lookupApi.js for the same
 * getCompanyMasterData call used the same way.
 */
export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

/**
 * Countries/states/cities scoped to this vendor's CompanyMaster.allowedCountries,
 * nested country -> states -> cities - same call admin/features/addUser uses
 * for its cascading Country -> State -> City dropdowns (see
 * admin/features/addUser/api/lookupApi.js).
 */
export const getLocationTaxBundle = () => apiRequest('/location-tax-bundle/get-location-tax-bundle');

export default {
  getCompanyMasterData,
  getLocationTaxBundle,
};
