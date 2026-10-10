import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/free-cash-usage';

// Drops empty values so the URL only carries what was actually set.
const toQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
};

/**
 * One page of the store's customers, each with the Free Cash they can spend
 * right now (store currency).
 *
 * @param {{ page?: number, limit?: number, search?: string, minAmount?: number|string,
 *   maxAmount?: number|string, customerStatus?: 'ALL'|'A'|'I',
 *   sort?: 'NAME'|'ACTIVE_HIGH_TO_LOW'|'ACTIVE_LOW_TO_HIGH' }} [params]
 * @returns {Promise<{ customers: Object[], pagination: Object, summary: Object }>}
 */
export const getCustomersFreeCash = (params) => apiRequest(`${BASE}/get-customers${toQueryString(params)}`);

/**
 * One customer's Free Cash: everything they were given and the full history.
 *
 * @param {string} userId
 * @returns {Promise<{ customer: Object, activeFreeCash: number, freeCash: Object[], events: Object[] }>}
 */
export const getCustomerFreeCashHistory = (userId) => apiRequest(`${BASE}/get-customer-history/${userId}`);

export default {
  getCustomersFreeCash,
  getCustomerFreeCashHistory,
};
