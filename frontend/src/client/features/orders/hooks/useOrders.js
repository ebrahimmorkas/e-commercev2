import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyOrders } from '../api/ordersApi';
import { useClientRealtime } from '../../../realtime/useClientRealtime';
import { REALTIME_RECONNECTED } from '../../../../utils/socketClient';
import { useToast } from '../../../../components/common/Toast';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';
const NOTIFICATION_TYPE_STATUS_CHANGED = 'STATUS_CHANGED';

/**
 * The customer's own orders list, kept live: any push about one of their
 * orders (a new order from another device, a status change, a payment)
 * re-fetches the list in place.
 */
export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { subscribe } = useClientRealtime();
  const toast = useToast();

  // useToast returns a fresh object every render - kept in a ref so the
  // realtime subscription below doesn't have to re-subscribe each time.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });

  // `silent` = a background resync: no loading state, and a failure keeps
  // the rows already on screen instead of replacing them with an error.
  const load = useCallback(async (silent) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await getMyOrders();
      setOrders(result?.orders || []);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Wrapped so it stays safe to hand straight to an onClick (which would
  // otherwise pass the click event in as `silent`).
  const reload = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    return subscribe(ORDERS_MODULE, ({ type, data }) => {
      if (type === NOTIFICATION_TYPE_STATUS_CHANGED) {
        toastRef.current.info(`Order #${data.orderNumber} is now "${data.currentStepName}"`);
      }
      // RECONNECTED lands here too - pushes sent while the socket was down
      // were lost, so a plain re-fetch is exactly the right resync.
      if (type === REALTIME_RECONNECTED || data?.orderId) load(true);
    });
  }, [subscribe, load]);

  return { orders, loading, error, reload };
};

export default useOrders;
