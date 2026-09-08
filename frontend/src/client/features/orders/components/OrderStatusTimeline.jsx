import { formatOrderDate } from '../utils/formatOrder';

/**
 * Renders Order.statusHistory (see backend/models/Order.js) as a vertical
 * timeline - each entry is a step the order has been through, in order.
 */
const OrderStatusTimeline = ({ statusHistory = [] }) => {
  if (statusHistory.length === 0) return null;

  return (
    <ol className="space-y-4">
      {statusHistory.map((entry, index) => {
        const isCurrent = index === statusHistory.length - 1;
        return (
          <li key={entry._id || `${entry.stepCode}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCurrent ? 'bg-amber-500' : 'bg-slate-300'}`}
              />
              {index < statusHistory.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>
                {entry.stepName}
              </p>
              <p className="text-xs text-slate-400">
                {formatOrderDate(entry.startedAt)}
                {entry.remarks ? ` · ${entry.remarks}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderStatusTimeline;
