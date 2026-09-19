import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyOrderById, cancelOrder as cancelOrderRequest } from '../api/ordersApi';
import { useClientRealtime } from '../../../realtime/useClientRealtime';
import { REALTIME_RECONNECTED } from '../../../../utils/socketClient';
import { useToast } from '../../../../components/common/Toast';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';
const NOTIFICATION_TYPE_STATUS_CHANGED = 'STATUS_CHANGED';

/**
 * One of the customer's own orders, kept live: a push for this order (the
 * store advanced it, a payment landed, it was cancelled from another device)
 * re-fetches it in place - no spinner flash, no manual refresh.
 */
export const useOrder = (orderId) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusCode, setStatusCode] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { subscribe } = useClientRealtime();
  const toast = useToast();

  // useToast returns a fresh object every render - kept in a ref so the
  // realtime subscription below doesn't have to re-subscribe each time.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });

  // `silent` = a background resync: no loading state, and a failure keeps
  // the order already on screen instead of replacing it with an error page.
  const load = useCallback(
    async (silent) => {
      if (!orderId) return;
      if (!silent) {
        setLoading(true);
        setError(null);
        setStatusCode(null);
      }
      try {
        const result = await getMyOrderById(orderId);
        setOrder(result?.order || null);
      } catch (err) {
        if (!silent) {
          setError(err.message || 'Failed to load order');
          setStatusCode(err.statusCode ?? null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId]
  );

  // Wrapped so it stays safe to hand straight to an onClick/onRetry (which
  // would otherwise pass the click event in as `silent`).
  const reload = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!orderId) return undefined;

    return subscribe(ORDERS_MODULE, ({ type, data }) => {
      if (type !== REALTIME_RECONNECTED && data?.orderId !== orderId) return;

      if (type === NOTIFICATION_TYPE_STATUS_CHANGED) {
        toastRef.current.info(`Order #${data.orderNumber} is now "${data.currentStepName}"`);
      }
      // Only GET /my-orders/:id runs the item enrichment (live image,
      // return/exchange status per item), so re-fetch instead of merging the
      // push's small delta into local state.
      load(true);
    });
  }, [subscribe, orderId, load]);

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

  return { order, loading, error, statusCode, cancelling, reload, cancel };
};
