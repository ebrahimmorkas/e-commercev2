import { apiRequest } from '../../../../utils/apiClient';

export const getCompanyMasterData = () => apiRequest('/company-master/get-company-master-data');

export const getAdminProducts = () => apiRequest('/products/get-products-admin');

export const getAdminCategories = () => apiRequest('/category/get-admin-categories');

export const getAdminBrands = () => apiRequest('/brands/get-all-brands-admin');

export const getAdminOrders = () => apiRequest('/orders/admin');

export const getAdminUsers = () => apiRequest('/users/get-all-users-admin');

export default {
  getCompanyMasterData,
  getAdminProducts,
  getAdminCategories,
  getAdminBrands,
  getAdminOrders,
  getAdminUsers,
};
