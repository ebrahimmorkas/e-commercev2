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

/**
 * Shipping estimate for the current cart. Without an addressId the backend
 * uses the logged-in user's default address, then the browsing-location
 * cookies; with one (checkout) it prices against that saved address.
 * `enabled: false` means shipping isn't switched on for this store - show nothing.
 */
export const getShippingEstimate = (addressId) =>
  apiRequest(`/cart/shipping-estimate${addressId ? `?addressId=${encodeURIComponent(addressId)}` : ''}`);

/**
 * Tax estimate for the current cart - same addressId/location rules as
 * getShippingEstimate, falling back to the store's own location.
 * @returns {Promise<{ totalTaxAmount: number, taxes: Array, isStoreLocation: boolean, deliveringTo: Object|null }>}
 */
export const getTaxEstimate = (addressId) =>
  apiRequest(`/cart/tax-estimate${addressId ? `?addressId=${encodeURIComponent(addressId)}` : ''}`);

export const checkoutCart = () => apiRequest('/cart/checkout-cart', { method: 'POST' });

/**
 * Free Cash the shopper could apply to the current cart. isEnabled false =
 * the store has no Free Cash (show nothing); requiresLogin = a guest.
 * @returns {Promise<{ isEnabled: boolean, requiresLogin: boolean, isMultipleFreeCashUsageAllowed: boolean, freeCash: Array }>}
 */
export const getEligibleFreeCash = () => apiRequest('/cart/eligible-free-cash');

/**
 * Replaces whatever Free Cash is applied with these. A rejected one comes
 * back in rejectedFreeCash (or, when none could be applied, as the thrown
 * ApiError's errors.rejected) with its reason.
 * @returns {Promise<{ cart: Object, appliedFreeCash: Array, rejectedFreeCash: Array }>}
 */
export const applyFreeCash = (freeCashIds) =>
  apiRequest('/cart/apply-free-cash', { method: 'POST', body: { freeCashIds } });

export const removeFreeCash = () => apiRequest('/cart/remove-free-cash', { method: 'DELETE' });

/**
 * Discounts the logged-in shopper could apply to the current cart, followed by
 * the ones meant for them that the cart can't use yet (isLocked, with
 * lockedReason). Coupon discounts come separately in `coupons` (same shape,
 * never the code - it must still be typed in); hasCouponDiscounts says whether
 * any exist for this shopper. isEnabled false = no discounts in this store;
 * requiresLogin = a guest.
 * @returns {Promise<{ isEnabled: boolean, requiresLogin: boolean, hasCouponDiscounts: boolean, discounts: Array, coupons: Array }>}
 */
export const getEligibleDiscounts = () => apiRequest('/cart/eligible-discounts');

/**
 * Replaces whatever discounts are applied with these (plus the coupon, if
 * given). A rejected one comes back in rejectedDiscounts (or, when none could
 * be applied, as the thrown ApiError's errors.rejected) with its reason.
 * @returns {Promise<{ cart: Object, appliedDiscounts: Array, rejectedDiscounts: Array }>}
 */
export const applyDiscounts = ({ discountIds = [], couponCode = '' } = {}) =>
  apiRequest('/cart/apply-discounts', { method: 'POST', body: { discountIds, couponCode } });

export const removeDiscounts = () => apiRequest('/cart/remove-discounts', { method: 'DELETE' });

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  checkoutCart,
  getShippingEstimate,
  getTaxEstimate,
  getEligibleFreeCash,
  applyFreeCash,
  removeFreeCash,
  getEligibleDiscounts,
  applyDiscounts,
  removeDiscounts,
};
