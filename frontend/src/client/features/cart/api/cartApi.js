import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront cart reads/writes. No client-side auth is wired up yet, so
 * these always go out as `auth: false` (no Authorization header) - the
 * backend still identifies the cart via the `guestCartId` cookie
 * (backend/middlewares/resolveCartOwner.js), which `credentials: 'include'`
 * (baked into apiRequest) sends automatically.
 */

export const getCart = () => apiRequest('/cart/get-cart', { auth: false });

export const addToCart = ({ productId, variantId, sizeId, quantity = 1 }) =>
  apiRequest('/cart/add-to-cart', {
    method: 'POST',
    auth: false,
    body: { productId, variantId, sizeId, quantity },
  });

export const updateCartItem = ({ productId, variantId, sizeId, quantity }) =>
  apiRequest('/cart/update-cart', {
    method: 'PUT',
    auth: false,
    body: { productId, variantId, sizeId, quantity },
  });

export const removeCartItem = ({ productId, variantId, sizeId }) =>
  apiRequest('/cart/remove-cart-item', {
    method: 'DELETE',
    auth: false,
    body: { productId, variantId, sizeId },
  });

export const checkoutCart = () => apiRequest('/cart/checkout-cart', { method: 'POST', auth: false });

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  checkoutCart,
};
