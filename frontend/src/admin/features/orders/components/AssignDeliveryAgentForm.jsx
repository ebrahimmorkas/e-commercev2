import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/**
 * There is no backend endpoint to list a vendor's deliveryAgent-role users,
 * so this takes their user id as plain text rather than a picker - see
 * orderAdminApi.js.
 *
 * @param {Function} onSubmit - (deliveryAgentUserId) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const AssignDeliveryAgentForm = ({ onSubmit, onCancel, submitting }) => {
  const [deliveryAgentUserId, setDeliveryAgentUserId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = deliveryAgentUserId.trim();
    if (!id) return;
    const success = await onSubmit(id);
    if (success) setDeliveryAgentUserId('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          placeholder="Delivery agent user ID"
          value={deliveryAgentUserId}
          onChange={(e) => setDeliveryAgentUserId(e.target.value)}
          className={inputClass}
          required
          pattern="^[0-9a-fA-F]{24}$"
          title="A 24-character user ID"
          disabled={submitting}
        />
        <p className="mt-1 text-xs text-gray-400">
          The Mongo _id of a user with the deliveryAgent role for this store.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting}>
          Assign agent
        </Button>
      </div>
    </form>
  );
};

export default AssignDeliveryAgentForm;
