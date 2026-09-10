import { formatOrderDateTime } from '../utils/formatOrder';

/** Renders Order.statusHistory (backend/models/Order.js) as a vertical timeline. */
const OrderStatusTimeline = ({ statusHistory = [] }) => {
  if (statusHistory.length === 0) return null;

  return (
    <ol className="space-y-4">
      {statusHistory.map((entry, index) => {
        const isCurrent = index === statusHistory.length - 1;
        return (
          <li key={entry._id || `${entry.stepCode}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCurrent ? 'bg-blue-600' : 'bg-gray-300'}`} />
              {index < statusHistory.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-semibold ${isCurrent ? 'text-gray-900' : 'text-gray-600'}`}>
                {entry.stepName}
                <span className="ml-2 text-xs font-normal text-gray-400">({entry.stepCode})</span>
              </p>
              <p className="text-xs text-gray-400">
                {formatOrderDateTime(entry.startedAt)}
                {entry.completedAt ? ` → ${formatOrderDateTime(entry.completedAt)}` : ''}
                {entry.isManualUpdate ? ' · manual' : ''}
              </p>
              {entry.remarks && <p className="text-xs text-gray-500 mt-0.5">{entry.remarks}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderStatusTimeline;
