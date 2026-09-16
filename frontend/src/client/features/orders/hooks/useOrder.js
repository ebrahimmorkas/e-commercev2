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
        await cancelOrderRequest(orderId, cancellationReason);
        // Re-fetch rather than trusting the POST response's bare order doc -
        // only GET /my-orders/:id runs the item enrichment (live image,
        // return/exchange status per item), see orderService.js.
        const result = await getMyOrderById(orderId);
        setOrder(result?.order || null);
        return result?.order || null;
      } finally {
        setCancelling(false);
      }
    },
    [orderId]
  );

  return { order, loading, error, cancelling, reload: load, cancel };
};

export default useOrder;
