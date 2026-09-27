import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/delivery-agents';

/**
 * The vendor's own delivery agents (backend/routes/deliveryAgentRoutes.js).
 * Needs the DELIVERY_AGENTS module and the delivery-agent feature on.
 */

/** @returns {Promise<{ agents: Array, limit: number, used: number }>} */
export const getDeliveryAgents = () => apiRequest(BASE);

export const getDeliveryAgentById = (id) => apiRequest(`${BASE}/${id}`);

export const createDeliveryAgent = (data) => apiRequest(BASE, { method: 'POST', body: data });

export const updateDeliveryAgent = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PATCH', body: data });

export const changeDeliveryAgentPassword = (id, newPassword) =>
  apiRequest(`${BASE}/${id}/password`, { method: 'PATCH', body: { newPassword } });

/** @param {'A'|'I'} status */
export const setDeliveryAgentStatus = (id, status) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { status } });

export const deleteDeliveryAgent = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

export default {
  getDeliveryAgents,
  getDeliveryAgentById,
  createDeliveryAgent,
  updateDeliveryAgent,
  changeDeliveryAgentPassword,
  setDeliveryAgentStatus,
  deleteDeliveryAgent,
};
