import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront order placement/history. All routes require a logged-in user
 * (see backend/routes/orderRoutes.js - authenticate + authorize('user')).
 *
 * NOTE: GET /my-orders/:id returns order totals, status history, the
 * shipping/billing address snapshot, AND a full line-item breakdown
 * (order.items - products/variants/sizes actually ordered, with a live
 * image and any return/exchange status). GET /my-orders (the list) omits
 * items for payload size - see backend/services/orderService.js.
 */

/**
 * @param {Object} payload - { shippingAddressId, billingAddressId?, orderNumber? }
 * @returns {Promise<{ order: Object, ineligibleItems: Array }>}
 */
export const placeOrder = (payload) => apiRequest('/orders/place-order', { method: 'POST', body: payload });

/** @returns {Promise<{ orders: Array }>} */
export const getMyOrders = () => apiRequest('/orders/my-orders');

/** @returns {Promise<{ order: Object }>} order.items is only populated here, not in getMyOrders. */
export const getMyOrderById = (id) => apiRequest(`/orders/my-orders/${id}`);

/**
 * @param {string} id
 * @param {string} cancellationReason
 * @returns {Promise<{ order: Object }>}
 */
export const cancelOrder = (id, cancellationReason) =>
  apiRequest(`/orders/my-orders/${id}/cancel`, { method: 'POST', body: { cancellationReason } });

export default { placeOrder, getMyOrders, getMyOrderById, cancelOrder };
