import { apiRequest, apiDownload } from '../../../../utils/apiClient';

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

/**
 * The PDF invoice for one of the logged-in customer's own orders (generated on the server).
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadMyInvoice = (id) => apiDownload(`/orders/my-orders/${id}/invoice`);

/**
 * The credit note raised when the customer's order was cancelled (only exists for cancelled orders that had an invoice).
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadMyCreditNote = (id) => apiDownload(`/orders/my-orders/${id}/invoice?type=credit-note`);

export default { placeOrder, getMyOrders, getMyOrderById, cancelOrder, downloadMyInvoice, downloadMyCreditNote };
