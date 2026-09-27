import { useCallback, useEffect, useRef, useState } from 'react';
import * as myDeliveriesApi from '../api/myDeliveriesApi';
import { useToast } from '../../../../components/common/Toast';
import { useRealtime } from '../../../realtime/useRealtime';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';
const AGENT_ASSIGNED = 'AGENT_ASSIGNED';
const AGENT_UNASSIGNED = 'AGENT_UNASSIGNED';

/**
 * The agent's orders for one view ('pending' | 'done'), kept live: any change
 * to one of their orders (assigned to them, taken off them, moved to another
 * step by the store) is pushed on their private channel and the list is
 * re-fetched in place. Plus the one action an agent has: making the store's
 * step change on an order.
 */
export const useMyDeliveries = (view) => {
  // `loadedView` is the view the current `orders` belong to - while it differs
  // from `view`, the new view is still loading.
  const [data, setData] = useState({ loadedView: null, orders: [], error: '' });
  const [submittingId, setSubmittingId] = useState(null);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { subscribe } = useRealtime();

  const load = useCallback(async () => {
    try {
      const result = await myDeliveriesApi.getMyDeliveries(view);
      setData({ loadedView: view, orders: result?.orders || [], error: '' });
    } catch (err) {
      setData((prev) => ({ loadedView: view, orders: prev.loadedView === view ? prev.orders : [], error: err.message || 'Failed to load your deliveries' }));
    }
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    myDeliveriesApi
      .getMyDeliveries(view)
      .then((result) => {
        if (!cancelled) setData({ loadedView: view, orders: result?.orders || [], error: '' });
      })
      .catch((err) => {
        if (!cancelled) setData({ loadedView: view, orders: [], error: err.message || 'Failed to load your deliveries' });
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(
    () =>
      subscribe(ORDERS_MODULE, ({ type, data: payload }) => {
        if (type === AGENT_ASSIGNED) {
          toastRef.current.info(`New delivery: order #${payload?.orderNumber} is assigned to you`);
        } else if (type === AGENT_UNASSIGNED) {
          toastRef.current.info(`Order #${payload?.orderNumber} was taken off your deliveries`);
        }
        // Best-effort: a failed background refresh keeps the current list.
        load().catch(() => {});
      }),
    [subscribe, load]
  );

  const makeStepChange = async (order) => {
    setSubmittingId(order._id);
    try {
      await myDeliveriesApi.makeStepChange(order._id);
      toast.success(`Order #${order.orderNumber} marked "${order.stepChange?.toStepName}"`);
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not update the order');
      return false;
    } finally {
      setSubmittingId(null);
      await load();
    }
  };

  const loading = data.loadedView !== view;
  return { orders: data.orders, loading, error: data.error, submittingId, makeStepChange };
};

export default useMyDeliveries;
