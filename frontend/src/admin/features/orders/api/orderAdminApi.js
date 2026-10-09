import { apiRequest, apiDownload } from '../../../../utils/apiClient';

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

/** Every status an order of this store can be in (its workflow steps, then Payment at Delivery / Rejected / Cancelled / Refunded) - the Orders page filter. @returns {Promise<{ statuses: Array<{ code: string, name: string }> }>} */
export const getOrderStatusOptions = () => apiRequest(`${BASE}/admin/status-options`);

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
 * Adds the shipping price to an order placed under manual (CUSTOM) shipping.
 * Allowed once per order; the amount is added to its grand total.
 * @param {string} id
 * @param {number} shippingAmount
 * @returns {Promise<{ order: Object }>}
 */
export const setOrderShippingPrice = (id, shippingAmount) =>
  apiRequest(`${BASE}/admin/${id}/shipping-price`, {
    method: 'PATCH',
    body: { shippingAmount },
  });

/**
 * Changes the shipping price already set on an order. Only available when the
 * platform + vendor "edit shipping price" gates are on (the order detail
 * response carries canEditShippingPrice) and payment hasn't been taken.
 * @param {string} id
 * @param {number} shippingAmount
 * @returns {Promise<{ order: Object }>}
 */
export const updateOrderShippingPrice = (id, shippingAmount) =>
  apiRequest(`${BASE}/admin/${id}/shipping-price`, {
    method: 'PUT',
    body: { shippingAmount },
  });

/**
 * The order's customer's saved addresses (to switch the delivery address to
 * one of them). Only available when both "edit shipping address" gates are on.
 * @param {string} id
 * @returns {Promise<{ addresses: Array }>}
 */
export const getOrderUserAddresses = (id) => apiRequest(`${BASE}/admin/${id}/user-addresses`);

/**
 * Changes where the order is delivered: pass { addressId } (one of the
 * customer's saved addresses) OR { addressText } (typed; stored on the order only).
 * @param {string} id
 * @param {{ addressId?: string, addressText?: string }} payload
 * @returns {Promise<{ order: Object }>}
 */
export const updateOrderShippingAddress = (id, payload) =>
  apiRequest(`${BASE}/admin/${id}/shipping-address`, { method: 'PUT', body: payload });

/**
 * Edit Order: the product picker (same one Place Order uses) and adding
 * products to a placed order. All gated by isEditingOrderFeatureOn.
 */
export const getEditCategories = () => apiRequest(`${BASE}/admin/edit/categories`);

export const getEditProducts = (categoryId) =>
  apiRequest(`${BASE}/admin/edit/products${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''}`);

/** Active products matching the text (name, code, variant, size, SKU, barcode) - for the product search box. */
export const searchEditProducts = (search) =>
  apiRequest(`${BASE}/admin/edit/products?search=${encodeURIComponent(search)}`);

/** { product, allowOutOfStockProductsAdding, variants: [{ variantId, variantName, sizes: [...] }] } */
export const getEditProductOptions = (productId) => apiRequest(`${BASE}/admin/edit/products/${productId}/options`);

/**
 * @param {string} id
 * @param {Array<{ productId: string, variantId: string, sizeId: string, quantity: number }>} items
 * @returns {Promise<{ order: Object }>}
 */
export const addProductsToOrder = (id, items, applyBulkPricing = false, manualTaxAmount = null) =>
  apiRequest(`${BASE}/admin/${id}/add-products`, {
    method: 'POST',
    // manualTaxAmount set = "Enter tax manually": one tax total for the added products.
    body: manualTaxAmount === null ? { items, applyBulkPricing } : { items, applyBulkPricing, isTaxManual: true, manualTaxAmount },
  });

/**
 * Live tax preview for products about to be added to an order - nothing is saved.
 * @param {{ orderId: string, items: Array, applyBulkPricing: boolean }} request
 * @returns {Promise<{ lines, taxes, totalTaxAmount, isTaxOff, isStoreLocation, isLocationMissing }>}
 */
export const previewAddProductsTax = ({ orderId, items, applyBulkPricing }) =>
  apiRequest(`${BASE}/admin/${orderId}/add-products/tax-preview`, { method: 'POST', body: { items, applyBulkPricing } });

/** The store's active delivery agents, for the Assign dropdown. @returns {Promise<{ agents: Array<{ _id, name, phone_no, openOrderCount }> }>} */
export const getAssignableDeliveryAgents = () => apiRequest(`${BASE}/admin/delivery-agents`);

/**
 * Assigns the order to an agent, or changes its agent (the history is kept on
 * the order), together with the delivery date. The customer is emailed.
 * @param {string} id
 * @param {string} deliveryAgentUserId
 * @param {string} deliveryDate - 'YYYY-MM-DD', today or later
 * @returns {Promise<{ order: Object }>}
 */
export const assignDeliveryAgent = (id, deliveryAgentUserId, deliveryDate) =>
  apiRequest(`${BASE}/admin/${id}/assign-delivery-agent`, {
    method: 'PATCH',
    body: { deliveryAgentUserId, deliveryDate },
  });

/**
 * Changes only the delivery date of an order that has an agent. The customer is emailed.
 * @param {string} id
 * @param {string} deliveryDate - 'YYYY-MM-DD', today or later
 */
export const changeDeliveryDate = (id, deliveryDate) =>
  apiRequest(`${BASE}/admin/${id}/delivery-date`, { method: 'PATCH', body: { deliveryDate } });

/**
 * Sets, changes or (courierId null) removes the order's courier. The customer is emailed.
 * @param {string} id
 * @param {string|null} courierId
 */
export const setOrderCourier = (id, courierId) =>
  apiRequest(`${BASE}/admin/${id}/courier`, { method: 'PATCH', body: { courierId } });

/** Takes the agent off the order. */
export const unassignDeliveryAgent = (id) => apiRequest(`${BASE}/admin/${id}/unassign-delivery-agent`, { method: 'PATCH' });

/**
 * The PDF invoice for any order of this vendor (generated on the server).
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadInvoiceAdmin = (id) => apiDownload(`${BASE}/admin/${id}/invoice`);

/**
 * The credit note of a cancelled/rejected order that had an invoice.
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadCreditNoteAdmin = (id) => apiDownload(`${BASE}/admin/${id}/invoice?type=credit-note`);

export default { getAllOrdersAdmin, getOrderByIdAdmin, getOrderStatusOptions, getOrderStepOptions, advanceOrderStep, getAssignableDeliveryAgents, unassignDeliveryAgent, changeDeliveryDate, setOrderCourier, setOrderShippingPrice, updateOrderShippingPrice, getOrderUserAddresses, updateOrderShippingAddress, getEditCategories, getEditProducts, searchEditProducts, getEditProductOptions, addProductsToOrder, previewAddProductsTax, assignDeliveryAgent, downloadInvoiceAdmin, downloadCreditNoteAdmin };
