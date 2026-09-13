import { apiRequest } from '../../../../utils/apiClient';

export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export default {
  getCompanyMasterData,
};
