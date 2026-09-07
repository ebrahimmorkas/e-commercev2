import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCart,
  addToCart as addToCartRequest,
  updateCartItem as updateCartItemRequest,
  removeCartItem as removeCartItemRequest,
  checkoutCart as checkoutCartRequest,
} from '../api/cartApi';
import { flattenCartLineItems, buildCartItemsMap } from '../utils/shapeCart';

/**
 * Loads and mutates the current shopper's real cart (guest cookie or
 * logged-in user - resolved server-side, see
 * backend/middlewares/resolveCartOwner.js). Subtotal/item-count are derived
 * client-side from the cart's own line items on every change, rather than
 * trusted from the server response, since add/update/remove all return just
 * `{ cart }` (only GET /get-cart also returns a cached subtotal/totalQuantity).
 *
 * `cartItems` is a { [sizeId]: quantity } map - the shape ProductCard/
 * QuantityStepper/ProductDetailPage already expect. `incrementItem`/
 * `decrementItem` take just a sizeId (matching those components' existing
 * call sites) and resolve the productId/variantId it belongs to from the
 * last-loaded cart internally.
 */
export const useCart = () => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCart();
      setCart(result?.cart || null);
    } catch (err) {
      setError(err.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lineItems = useMemo(() => flattenCartLineItems(cart), [cart]);
  const cartItems = useMemo(() => buildCartItemsMap(cart), [cart]);
  const lineItemBySizeId = useMemo(() => new Map(lineItems.map((item) => [item.sizeId, item])), [lineItems]);

  const cartCount = useMemo(() => lineItems.reduce((sum, item) => sum + item.quantity, 0), [lineItems]);
  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [lineItems]);

  const addToCart = useCallback(async ({ productId, variantId, sizeId, quantity = 1 }) => {
    const result = await addToCartRequest({ productId, variantId, sizeId, quantity });
    setCart(result.cart);
    return result.cart;
  }, []);

  // Shared by increment/decrement: looks up the line item's productId/
  // variantId by sizeId and PUTs the new quantity. Quantity 0 (or below) is
  // handled server-side as a removal (backend/services/cartService.js
  // updateCartItemQuantity), so decrementing to 0 needs no separate call.
  const changeItemQuantity = useCallback(
    async (sizeId, delta) => {
      const line = lineItemBySizeId.get(sizeId);
      if (!line) return null;

      const result = await updateCartItemRequest({
        productId: line.productId,
        variantId: line.variantId,
        sizeId: line.sizeId,
        quantity: Math.max(line.quantity + delta, 0),
      });
      setCart(result.cart);
      return result.cart;
    },
    [lineItemBySizeId]
  );

  const incrementItem = useCallback((sizeId) => changeItemQuantity(sizeId, 1), [changeItemQuantity]);
  const decrementItem = useCallback((sizeId) => changeItemQuantity(sizeId, -1), [changeItemQuantity]);

  const removeItem = useCallback(
    async (sizeId) => {
      const line = lineItemBySizeId.get(sizeId);
      if (!line) return null;

      const result = await removeCartItemRequest({
        productId: line.productId,
        variantId: line.variantId,
        sizeId: line.sizeId,
      });
      setCart(result.cart);
      return result.cart;
    },
    [lineItemBySizeId]
  );

  // Only meaningful for a logged-in user's cart (see
  // backend/services/cartService.js checkoutCart) - resolves/throws either
  // way, letting the caller surface whatever message the backend returns.
  const checkout = useCallback(async () => {
    const result = await checkoutCartRequest();
    setCart(result.cart);
    return result;
  }, []);

  return {
    cart,
    lineItems,
    cartItems,
    cartCount,
    subtotal,
    loading,
    error,
    reload: load,
    addToCart,
    incrementItem,
    decrementItem,
    removeItem,
    checkout,
  };
};

export default useCart;
