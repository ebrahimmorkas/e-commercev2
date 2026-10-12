import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/abandoned-cart';

/**
 * Fetches every currently-abandoned cart for the current vendor, admin view.
 */
export const getAllAbandonedCartsAdmin = () => apiRequest(BASE);

/**
 * Places the order for one customer's abandoned cart straight away: everything
 * in the cart at today's prices, with no shipping price, discount or address.
 * The customer's cart is emptied. Needs Place Order to be on for the account.
 * @param {string} cartId - The row's _id.
 * @returns {Promise<{ _id: string, orderNumber: string }>}
 */
export const placeOrderFromAbandonedCart = (cartId) => apiRequest(`${BASE}/${cartId}/place-order`, { method: 'POST' });

export default {
  getAllAbandonedCartsAdmin,
  placeOrderFromAbandonedCart,
};
