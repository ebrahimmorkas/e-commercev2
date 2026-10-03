import { apiRequest } from '../../../../utils/apiClient';
import { getCompanyMasterData } from '../../../../utils/companyMasterApi';

export { getCompanyMasterData };

export const getAdminCategories = () => apiRequest('/category/get-admin-categories');

export const getAdminBrands = () => apiRequest('/brands/get-all-brands-admin');

export const getAdminOrders = () => apiRequest('/orders/admin');

export const getAdminUsers = () => apiRequest('/users/get-all-users-admin');

export default {
  getCompanyMasterData,
  getAdminCategories,
  getAdminBrands,
  getAdminOrders,
  getAdminUsers,
};
