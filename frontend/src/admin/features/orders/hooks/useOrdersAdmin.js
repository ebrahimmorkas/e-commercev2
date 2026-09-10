import { useCallback, useEffect, useState } from 'react';
import { getAllOrdersAdmin } from '../api/orderAdminApi';

/** Owns the all-orders list for the admin Orders page. */
export const useOrdersAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllOrdersAdmin();
      setOrders(data?.orders || []);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
};

export default useOrdersAdmin;
