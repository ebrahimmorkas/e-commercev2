import { apiRequest } from '../../../../utils/apiClient';

export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export const getAdminCategories = () => apiRequest('/category/get-admin-categories');

/**
 * @param {'PRODUCT'|'CATEGORY'|'USER'} groupType
 */
export const getGroups = (groupType) => apiRequest(`/groups?groupType=${groupType}`);

export default {
  getCompanyMasterData,
  getAdminCategories,
  getGroups,
};
