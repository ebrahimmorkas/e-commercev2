import { apiRequest } from '../../../../utils/apiClient';
import { getCompanyMasterData } from '../../../../utils/companyMasterApi';

export { getCompanyMasterData };

/**
 * @param {'PRODUCT'|'CATEGORY'|'USER'} groupType
 */
export const getGroups = (groupType) => apiRequest(`/groups?groupType=${groupType}`);

export default {
  getCompanyMasterData,
  getGroups,
};
