import { useCallback, useEffect, useState } from 'react';
import { getOrderByIdAdmin, getOrderStepOptions, advanceOrderStep, assignDeliveryAgent } from '../api/orderAdminApi';
import { useToast } from '../../../../components/common/Toast';
import { useRealtime } from '../../../realtime/useRealtime';
import { REALTIME_RECONNECTED } from '../../../../utils/socketClient';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';

/**
 * Owns a single order's detail state plus the two admin mutations
 * (advance step, assign delivery agent), each surfacing errors via toast
 * and returning a boolean so callers can just check the result. Also keeps
 * the open order live: a push for this same order (customer cancelled,
 * payment landed, another admin advanced it) re-fetches it in place.
 */
export const useOrderAdmin = (orderId) => {
  const [order, setOrder] = useState(null);
  const [stepOptions, setStepOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const [orderData, stepsData] = await Promise.all([getOrderByIdAdmin(orderId), getOrderStepOptions(orderId)]);
      setOrder(orderData?.order || null);
      setStepOptions(stepsData?.steps || []);
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Re-fetches order+steps WITHOUT toggling `loading` (mutating already
  // covers the in-flight UI state for these two actions) - used after a
  // mutation instead of trusting the PATCH response's bare order doc, since
  // only GET .../admin/:id runs the item enrichment (live image,
  // return/exchange status per item, see orderService.js).
  const refreshOrderSilently = useCallback(async () => {
    const [orderData, stepsData] = await Promise.all([getOrderByIdAdmin(orderId), getOrderStepOptions(orderId)]);
    setOrder(orderData?.order || null);
    setStepOptions(stepsData?.steps || []);
  }, [orderId]);

  const { subscribe } = useRealtime();

  useEffect(() => {
    if (!orderId) return undefined;

    return subscribe(ORDERS_MODULE, ({ type, data }) => {
      if (type !== REALTIME_RECONNECTED && data?.orderId !== orderId) return;
      // Best-effort: a failed background refresh just leaves the current
      // view as-is rather than surfacing an error for something the admin
      // didn't ask for.
      refreshOrderSilently().catch(() => {});
    });
  }, [subscribe, orderId, refreshOrderSilently]);

  const advanceStep = async (targetStepCode, remarks) => {
    setMutating(true);
    try {
      await advanceOrderStep(orderId, targetStepCode, remarks);
      await refreshOrderSilently();
      toast.success('Order status updated');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not update order status');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const assignAgent = async (deliveryAgentUserId) => {
    setMutating(true);
    try {
      await assignDeliveryAgent(orderId, deliveryAgentUserId);
      await refreshOrderSilently();
      toast.success('Delivery agent assigned');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not assign delivery agent');
      return false;
    } finally {
      setMutating(false);
    }
  };

  return { order, stepOptions, loading, error, mutating, refetch: fetchOrder, advanceStep, assignAgent };
};

export default useOrderAdmin;
