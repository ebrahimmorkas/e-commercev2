import { useCallback, useEffect, useState } from 'react';
import * as abandonedCartApi from '../api/abandonedCartApi';
import { getUserAddresses } from '../../adminPlaceOrder/api/adminPlaceOrderApi';
import { useRealtime } from '../../../realtime/useRealtime';
import { useToast } from '../../../../components/common/Toast';

// Must match backend's constants/abandonedCartConstants.js.
const ABANDONED_CART_MODULE = 'ABANDONED_CART';

/**
 * Owns the abandoned-carts list for the admin page: the initial fetch, plus
 * live updates over the shared realtime channel - no polling or manual
 * refresh needed once mounted.
 *
 * Every push (NEW / RECOVERED / UPDATED, and the synthetic RECONNECTED after
 * a dropped connection) just re-reads the list quietly: a customer's row
 * folds several carts together (logged-in + guest), so the server's own
 * grouping is the only reliable source for what a row should now show.
 */
export const useAbandonedCarts = () => {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const { subscribe } = useRealtime();
  const toast = useToast();

  const fetchCarts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await abandonedCartApi.getAllAbandonedCartsAdmin();
      setCarts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load abandoned carts');
      setCarts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Same read without the loading state, so a live update never blanks the table.
  // Best-effort: a failed background refresh leaves the current rows as they are.
  const refreshSilently = useCallback(async () => {
    try {
      const data = await abandonedCartApi.getAllAbandonedCartsAdmin();
      setCarts(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      // Keep what is on screen.
    }
  }, []);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  useEffect(() => subscribe(ABANDONED_CART_MODULE, () => refreshSilently()), [subscribe, refreshSilently]);

  // The customer's saved addresses, for choosing where the order is delivered
  // (the same list the Place Order page offers). Resolves [] when it fails -
  // the admin can still type the address.
  const loadAddresses = useCallback(async (userId) => {
    try {
      const list = await getUserAddresses(userId);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  // Places the order for a row's cart straight away, delivered to `address`
  // ({ addressId } or { addressText }). Resolves true on success; the row
  // then leaves the list (the server also pushes that).
  const placeOrder = async (cartId, address) => {
    setPlacingOrder(true);
    try {
      const order = await abandonedCartApi.placeOrderFromAbandonedCart(cartId, address);
      toast.success(`Order ${order?.orderNumber || ''} placed successfully`);
      await refreshSilently();
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not place the order');
      return false;
    } finally {
      setPlacingOrder(false);
    }
  };

  return { carts, loading, error, refetch: fetchCarts, placeOrder, placingOrder, loadAddresses };
};

export default useAbandonedCarts;
