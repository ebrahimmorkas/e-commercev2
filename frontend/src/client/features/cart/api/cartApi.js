import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront cart reads/writes. Reachable by both guests and logged-in users
 * (backend/middlewares/resolveCartOwner.js) - `auth: true` (the apiRequest
 * default) attaches the Authorization header when an access token exists in
 * memory, so a logged-in customer's cart is correctly tied to their userId
 * instead of a guest cookie, and also gets apiRequest's built-in
 * refresh-and-retry if that token has expired mid-session. A guest visitor
 * has no token to attach either way, so this is a no-op for them - the
 * backend falls back to the `guestCartId` cookie, sent automatically via
 * `credentials: 'include'`.
 */

export const getCart = () => apiRequest('/cart/get-cart');

export const addToCart = ({ productId, variantId, sizeId, quantity = 1 }) =>
  apiRequest('/cart/add-to-cart', {
    method: 'POST',
    body: { productId, variantId, sizeId, quantity },
  });

export const updateCartItem = ({ productId, variantId, sizeId, quantity }) =>
  apiRequest('/cart/update-cart', {
    method: 'PUT',
    body: { productId, variantId, sizeId, quantity },
  });

export const removeCartItem = ({ productId, variantId, sizeId }) =>
  apiRequest('/cart/remove-cart-item', {
    method: 'DELETE',
    body: { productId, variantId, sizeId },
  });

export const checkoutCart = () => apiRequest('/cart/checkout-cart', { method: 'POST' });

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  checkoutCart,
};
