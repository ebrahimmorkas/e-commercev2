import { useCallback, useEffect, useState } from 'react';
import * as abandonedCartApi from '../api/abandonedCartApi';
import { useRealtime } from '../../../realtime/useRealtime';

const ABANDONED_CART_MODULE = 'ABANDONED_CART';
const NOTIFICATION_TYPE_NEW = 'NEW';
const NOTIFICATION_TYPE_RECOVERED = 'RECOVERED';

/**
 * Owns the abandoned-carts list for the admin page: the initial fetch, plus
 * live NEW/RECOVERED updates pushed over the shared realtime channel - no
 * polling or manual refresh needed once mounted.
 */
export const useAbandonedCarts = () => {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { subscribe } = useRealtime();

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

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  useEffect(() => {
    return subscribe(ABANDONED_CART_MODULE, (payload) => {
      const { type, data } = payload;

      if (type === NOTIFICATION_TYPE_NEW) {
        setCarts((prev) => {
          if (prev.some((cart) => cart._id === data.cartId)) return prev;
          return [{ _id: data.cartId, ...data }, ...prev];
        });
        return;
      }

      if (type === NOTIFICATION_TYPE_RECOVERED) {
        setCarts((prev) => prev.filter((cart) => cart._id !== data.cartId));
      }
    });
  }, [subscribe]);

  return { carts, loading, error, refetch: fetchCarts };
};

export default useAbandonedCarts;
