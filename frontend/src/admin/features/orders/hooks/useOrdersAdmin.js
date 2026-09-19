import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllOrdersAdmin } from '../api/orderAdminApi';
import { useRealtime } from '../../../realtime/useRealtime';
import { REALTIME_RECONNECTED } from '../../../../utils/socketClient';
import { useToast } from '../../../../components/common/Toast';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';
const NOTIFICATION_TYPE_NEW = 'NEW';
const NOTIFICATION_TYPE_CANCELLED = 'CANCELLED';

// The push payload is a small delta (see backend orderRealtimeService.js), not
// a full order - it only carries what this list's columns show, so it's
// merged over the row we already have.
const applyOrderDelta = (row, data) => ({
  ...row,
  orderNumber: data.orderNumber ?? row.orderNumber,
  currentStepCode: data.currentStepCode ?? row.currentStepCode,
  currentStepName: data.currentStepName ?? row.currentStepName,
  payment: {
    ...row.payment,
    status: data.paymentStatus ?? row.payment?.status,
    method: data.paymentMethod ?? row.payment?.method,
  },
  updatedAt: data.updatedAt ?? row.updatedAt,
});

/**
 * Owns the all-orders list for the admin Orders page: the initial fetch, plus
 * live updates pushed over the shared realtime channel - new orders, status /
 * payment / agent changes and customer cancellations - so no manual refresh
 * is needed once mounted.
 */
export const useOrdersAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { subscribe } = useRealtime();
  const toast = useToast();

  // The realtime handler is registered once but needs the latest orders (is
  // this order already in the list?) and toast, without re-subscribing on
  // every render.
  const ordersRef = useRef(orders);
  const toastRef = useRef(toast);
  useEffect(() => {
    ordersRef.current = orders;
    toastRef.current = toast;
  });

  // `silent` = a background resync: no loading spinner, and a failure keeps
  // the rows already on screen instead of blanking the table.
  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getAllOrdersAdmin();
      setOrders(data?.orders || []);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
      if (!silent) setOrders([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Wrapped so it stays safe to hand straight to an onClick (which would
  // otherwise pass the click event in as `silent`).
  const refetch = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    return subscribe(ORDERS_MODULE, ({ type, data }) => {
      // Pushes sent while the socket was down were lost - resync.
      if (type === REALTIME_RECONNECTED) {
        load(true);
        return;
      }

      if (type === NOTIFICATION_TYPE_NEW) {
        toastRef.current.info(`New order #${data.orderNumber} received`);
        // The row needs the full order shape, which the push doesn't carry.
        load(true);
        return;
      }

      const isKnown = ordersRef.current.some((row) => row._id === data.orderId);
      if (!isKnown) {
        load(true);
        return;
      }

      setOrders((prev) => prev.map((row) => (row._id === data.orderId ? applyOrderDelta(row, data) : row)));

      if (type === NOTIFICATION_TYPE_CANCELLED) {
        toastRef.current.info(`Order #${data.orderNumber} was cancelled by the customer`);
      }
    });
  }, [subscribe, load]);

  return { orders, loading, error, refetch };
};

export default useOrdersAdmin;
