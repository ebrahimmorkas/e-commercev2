import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/users';

/**
 * @param {Object} data - { name, username, email, phone_no, whatsapp_no, password, country, state, city }
 */
export const createUser = (data) => apiRequest(`${BASE}/create-user-admin`, { method: 'POST', body: data });

export default {
  createUser,
};
