import { useEffect, useState } from 'react';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import DatePicker from '../../../../components/common/DatePicker';
import { toDeliveryDateValue, todayStart } from '../utils/deliveryDate';
import { getAssignableDeliveryAgents } from '../api/orderAdminApi';
import theme from '../theme/theme';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/**
 * Picks one of the store's active delivery agents (GET /orders/admin/delivery-agents)
 * and the delivery date. Used both to assign an agent and to change the
 * current one (the date is then pre-filled and can be edited).
 *
 * @param {string|null} currentAgentId - the order's current agent (left out of the list)
 * @param {string} currentDeliveryDate - the order's delivery date ('YYYY-MM-DD'), or ''
 * @param {Function} onSubmit - (deliveryAgentUserId, deliveryDate 'YYYY-MM-DD') => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const AssignDeliveryAgentForm = ({ currentAgentId = null, currentDeliveryDate = '', onSubmit, onCancel, submitting }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deliveryAgentUserId, setDeliveryAgentUserId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(currentDeliveryDate);

  useEffect(() => {
    let cancelled = false;
    getAssignableDeliveryAgents()
      .then((data) => {
        if (!cancelled) setAgents((data?.agents || []).filter((agent) => agent._id !== currentAgentId));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load delivery agents');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentAgentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deliveryAgentUserId || !deliveryDate) return;
    const success = await onSubmit(deliveryAgentUserId, deliveryDate);
    if (success) setDeliveryAgentUserId('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        {loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-gray-500">No other active delivery agents. Add or activate one on the Delivery Agents page.</p>
        ) : (
          <select value={deliveryAgentUserId} onChange={(e) => setDeliveryAgentUserId(e.target.value)} className={inputClass} required disabled={submitting}>
            <option value="" disabled>
              Select a delivery agent
            </option>
            {agents.map((agent) => (
              <option key={agent._id} value={agent._id}>
                {agent.name} - {agent.phone_no} ({agent.openOrderCount} to deliver)
              </option>
            ))}
          </select>
        )}
      </div>
      {!loadError && agents.length > 0 && (
        <DatePicker
          label="Delivery date"
          name="deliveryDate"
          value={deliveryDate}
          onChange={(date) => setDeliveryDate(toDeliveryDateValue(date))}
          minDate={todayStart()}
          required
          disabled={submitting}
          helperText="Shown to the customer in the email about their delivery agent."
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting} disabled={!deliveryAgentUserId || !deliveryDate}>
          {currentAgentId ? 'Change agent' : 'Assign agent'}
        </Button>
      </div>
    </form>
  );
};

export default AssignDeliveryAgentForm;
