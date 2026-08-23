import { apiRequest } from '../../../../utils/apiClient';

export const getAdminCategories = () => apiRequest('/category/get-admin-categories');

export const getSizes = () => apiRequest('/sizes/get-sizes');

export const getUnits = () => apiRequest('/units/get-units');

export const getLocationTaxBundle = () => apiRequest('/location-tax-bundle/get-location-tax-bundle');

export const getCompanySettings = () => apiRequest('/company-settings/get-company-settings');

export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export default {
  getAdminCategories,
  getSizes,
  getUnits,
  getLocationTaxBundle,
  getCompanySettings,
  getCompanyMasterData,
};
