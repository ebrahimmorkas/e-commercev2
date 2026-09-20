import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront address book. All routes require a logged-in user (see
 * backend/routes/addressRoutes.js).
 */

export const listAddresses = () => apiRequest('/address/get-address');

export const getAddressById = (id) => apiRequest(`/address/${id}`);

export const createAddress = (payload) => apiRequest('/address/add-address', { method: 'POST', body: payload });

export const updateAddress = (id, payload) =>
  apiRequest(`/address/update-address/${id}`, { method: 'PUT', body: payload });

export const deleteAddress = (id) => apiRequest(`/address/delete-address/${id}`, { method: 'DELETE' });

export default { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress };
