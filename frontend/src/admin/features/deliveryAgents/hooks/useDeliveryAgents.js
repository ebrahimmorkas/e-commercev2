import { useCallback, useEffect, useState } from 'react';
import * as deliveryAgentApi from '../api/deliveryAgentApi';
import { useToast } from '../../../../components/common/Toast';
import { useRealtime } from '../../../realtime/useRealtime';

// Must match backend's constants/orderRealtimeConstants.js.
const ORDERS_MODULE = 'ORDERS';

const applyResult = (data) => ({ agents: data?.agents || [], limit: data?.limit ?? 0, used: data?.used ?? 0, error: '' });

/**
 * The vendor's delivery agents plus the plan limit, and every mutation on
 * them. Each mutation toasts its own result and returns a boolean. Each
 * agent's "orders to deliver" count stays live: any order push re-fetches it.
 */
export const useDeliveryAgents = () => {
  const [state, setState] = useState({ agents: [], limit: 0, used: 0, error: '' });
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    deliveryAgentApi
      .getDeliveryAgents()
      .then((data) => {
        if (!cancelled) setState(applyResult(data));
      })
      .catch((err) => {
        if (!cancelled) setState((prev) => ({ ...prev, error: err.message || 'Failed to load delivery agents' }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      setState(applyResult(await deliveryAgentApi.getDeliveryAgents()));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err.message || 'Failed to load delivery agents' }));
    }
  }, []);

  const { subscribe } = useRealtime();
  // Best-effort: a failed background refresh keeps the current list.
  useEffect(() => subscribe(ORDERS_MODULE, () => refetch().catch(() => {})), [subscribe, refetch]);

  const run = async (action, successMessage, failureMessage) => {
    setMutating(true);
    try {
      await action();
      await refetch();
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return false;
    } finally {
      setMutating(false);
    }
  };

  const fetchAgentById = async (id) => {
    try {
      return await deliveryAgentApi.getDeliveryAgentById(id);
    } catch (err) {
      toast.error(err.message || 'Could not load the delivery agent');
      return null;
    }
  };

  const addAgent = (data) => run(() => deliveryAgentApi.createDeliveryAgent(data), 'Delivery agent created', 'Could not create the delivery agent');
  const editAgent = (id, data) => run(() => deliveryAgentApi.updateDeliveryAgent(id, data), 'Delivery agent updated', 'Could not update the delivery agent');
  const changeAgentPassword = (id, newPassword) =>
    run(() => deliveryAgentApi.changeDeliveryAgentPassword(id, newPassword), 'Password changed - the agent was signed out everywhere', 'Could not change the password');
  const toggleStatus = (agent) => {
    const next = agent.status === 'A' ? 'I' : 'A';
    return run(
      () => deliveryAgentApi.setDeliveryAgentStatus(agent._id, next),
      next === 'A' ? 'Delivery agent activated' : 'Delivery agent deactivated',
      'Could not change the status'
    );
  };
  const removeAgent = (id) => run(() => deliveryAgentApi.deleteDeliveryAgent(id), 'Delivery agent deleted', 'Could not delete the delivery agent');

  return {
    agents: state.agents,
    limit: state.limit,
    used: state.used,
    error: state.error,
    loading,
    mutating,
    refetch,
    fetchAgentById,
    addAgent,
    editAgent,
    changeAgentPassword,
    toggleStatus,
    removeAgent,
  };
};

export default useDeliveryAgents;
