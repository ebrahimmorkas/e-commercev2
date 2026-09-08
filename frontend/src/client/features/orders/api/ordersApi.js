import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront order placement/history. All routes require a logged-in user
 * (see backend/routes/orderRoutes.js - authenticate + authorize('user')).
 *
 * NOTE: GET /my-orders and /my-orders/:id return order totals, status
 * history, and the shipping/billing address snapshot, but NOT a line-item
 * list - Order only stores a reference to its (now-deactivated) cart, and
 * there's no route to fetch a deactivated cart by id (see
 * backend/services/orderService.js / cartService.js). Order pages can't
 * show "what was in this order" until that's added backend-side.
 */

/**
 * @param {Object} payload - { shippingAddressId, billingAddressId?, orderNumber? }
 * @returns {Promise<{ order: Object, ineligibleItems: Array }>}
 */
export const placeOrder = (payload) => apiRequest('/orders/place-order', { method: 'POST', body: payload });

/** @returns {Promise<{ orders: Array }>} */
export const getMyOrders = () => apiRequest('/orders/my-orders');

/** @returns {Promise<{ order: Object }>} */
export const getMyOrderById = (id) => apiRequest(`/orders/my-orders/${id}`);

/**
 * @param {string} id
 * @param {string} cancellationReason
 * @returns {Promise<{ order: Object }>}
 */
export const cancelOrder = (id, cancellationReason) =>
  apiRequest(`/orders/my-orders/${id}/cancel`, { method: 'POST', body: { cancellationReason } });

export default { placeOrder, getMyOrders, getMyOrderById, cancelOrder };
