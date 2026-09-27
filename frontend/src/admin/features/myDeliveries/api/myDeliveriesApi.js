import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/orders/delivery-agent';

/**
 * The logged-in delivery agent's own orders (backend/routes/orderRoutes.js,
 * authorize('deliveryAgent')).
 * @param {'pending'|'done'} view - pending: still to deliver; done: already delivered by them
 * @returns {Promise<{ orders: Array }>}
 */
export const getMyDeliveries = (view) => apiRequest(`${BASE}/my-orders?view=${view}`);

/** Makes the store's delivery-agent step change on one order (e.g. Dispatched -> Delivered). */
export const makeStepChange = (orderId) => apiRequest(`${BASE}/${orderId}/advance-step`, { method: 'PATCH' });

export default { getMyDeliveries, makeStepChange };
