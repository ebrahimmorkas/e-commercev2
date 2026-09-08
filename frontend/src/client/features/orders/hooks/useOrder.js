import { useCallback, useEffect, useState } from 'react';
import { getMyOrderById, cancelOrder as cancelOrderRequest } from '../api/ordersApi';

export const useOrder = (orderId) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMyOrderById(orderId);
      setOrder(result?.order || null);
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = useCallback(
    async (cancellationReason) => {
      setCancelling(true);
      try {
        const result = await cancelOrderRequest(orderId, cancellationReason);
        setOrder(result.order);
        return result.order;
      } finally {
        setCancelling(false);
      }
    },
    [orderId]
  );

  return { order, loading, error, cancelling, reload: load, cancel };
};

export default useOrder;
