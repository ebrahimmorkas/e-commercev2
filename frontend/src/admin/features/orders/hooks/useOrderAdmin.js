import { useCallback, useEffect, useState } from 'react';
import { getOrderByIdAdmin, getOrderStepOptions, advanceOrderStep, assignDeliveryAgent } from '../api/orderAdminApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns a single order's detail state plus the two admin mutations
 * (advance step, assign delivery agent), each surfacing errors via toast
 * and returning a boolean so callers can just check the result.
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

  const advanceStep = async (targetStepCode, remarks) => {
    setMutating(true);
    try {
      const data = await advanceOrderStep(orderId, targetStepCode, remarks);
      setOrder(data.order);
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
      const data = await assignDeliveryAgent(orderId, deliveryAgentUserId);
      setOrder(data.order);
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
