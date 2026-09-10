import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/orders';

/**
 * Admin order management. All routes require an authenticated admin
 * (backend/routes/orderRoutes.js - authenticate + authorize('admin')).
 *
 * NOTE: there is no backend endpoint to list a vendor's delivery-agent-role
 * users, so AssignDeliveryAgentForm takes a user id as plain text rather
 * than a populated dropdown - see that component. The workflow step codes
 * for AdvanceStepForm's dropdown come from GET /admin/:id/steps below.
 */

/** @returns {Promise<{ orders: Array }>} */
export const getAllOrdersAdmin = () => apiRequest(`${BASE}/admin`);

/** @returns {Promise<{ order: Object }>} */
export const getOrderByIdAdmin = (id) => apiRequest(`${BASE}/admin/${id}`);

/** @returns {Promise<{ steps: Array<{ code: string, name: string, sequence: number }> }>} */
export const getOrderStepOptions = (id) => apiRequest(`${BASE}/admin/${id}/steps`);

/**
 * @param {string} id
 * @param {string} targetStepCode
 * @param {string} [remarks]
 * @returns {Promise<{ order: Object }>}
 */
export const advanceOrderStep = (id, targetStepCode, remarks) =>
  apiRequest(`${BASE}/admin/${id}/advance-step`, {
    method: 'PATCH',
    body: { targetStepCode, remarks: remarks || null },
  });

/**
 * @param {string} id
 * @param {string} deliveryAgentUserId
 * @returns {Promise<{ order: Object }>}
 */
export const assignDeliveryAgent = (id, deliveryAgentUserId) =>
  apiRequest(`${BASE}/admin/${id}/assign-delivery-agent`, {
    method: 'PATCH',
    body: { deliveryAgentUserId },
  });

export default { getAllOrdersAdmin, getOrderByIdAdmin, getOrderStepOptions, advanceOrderStep, assignDeliveryAgent };
