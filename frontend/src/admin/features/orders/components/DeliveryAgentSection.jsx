import { formatOrderDateTime } from '../utils/formatOrder';

/**
 * The order's delivery agent: who has it now, every assignment so far
 * (Order.deliveryAgentAssignments), and when the agent's step change was made
 * and by whom. Renders nothing for an order that never had an agent.
 */
const DeliveryAgentSection = ({ order }) => {
  const assignments = order?.deliveryAgentAssignments || [];
  if (assignments.length === 0 && !order?.deliveryAgentTransitionAt) return null;

  const current = assignments.find((entry) => !entry.unassignedAt);

  return (
    <div className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Delivery agent</h3>
      <p className="text-sm text-gray-700">
        {current ? (
          <>
            <span className="font-medium text-gray-900">{current.deliveryAgentName || 'Agent'}</span> - assigned {formatOrderDateTime(current.assignedAt)}
          </>
        ) : (
          'No agent on this order right now.'
        )}
      </p>
      {order.deliveryAgentTransitionAt && (
        <p className="text-sm text-gray-700 mt-1">
          Agent step done {formatOrderDateTime(order.deliveryAgentTransitionAt)}
          {order.deliveryAgentTransitionByRole === 'admin' ? ' (by an admin, for the agent)' : ' (by the agent)'}
        </p>
      )}
      {assignments.length > 1 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer">Assignment history ({assignments.length})</summary>
          <ol className="mt-2 space-y-1 text-xs text-gray-600">
            {assignments.map((entry, index) => (
              <li key={`${entry.deliveryAgentId}-${index}`}>
                {entry.deliveryAgentName || 'Agent'}: {formatOrderDateTime(entry.assignedAt)}
                {entry.unassignedAt ? ` → ${formatOrderDateTime(entry.unassignedAt)}` : ' → now'}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
};

export default DeliveryAgentSection;
