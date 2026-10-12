import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/abandoned-cart';

/**
 * Fetches every currently-abandoned cart for the current vendor, admin view.
 */
export const getAllAbandonedCartsAdmin = () => apiRequest(BASE);

/**
 * Places the order for one customer's abandoned cart straight away: everything
 * in the cart at today's prices, with no shipping price or discount, delivered
 * to the given address. The customer's cart is emptied. Needs Place Order to
 * be on for the account.
 * @param {string} cartId - The row's _id.
 * @param {{ addressId: string } | { addressText: string }} address - One of
 *   the customer's saved addresses, or an address typed by the admin.
 * @returns {Promise<{ _id: string, orderNumber: string }>}
 */
export const placeOrderFromAbandonedCart = (cartId, address) => apiRequest(`${BASE}/${cartId}/place-order`, { method: 'POST', body: address });

export default {
  getAllAbandonedCartsAdmin,
  placeOrderFromAbandonedCart,
};
