import theme from '../../Home/theme/theme';
import { formatOrderMoney, formatOrderDate } from '../utils/formatOrder';

const OrderCard = ({ order, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-xl border p-4 sm:p-5 transition-shadow duration-150 cursor-pointer ${theme.card.background} ${theme.card.border} hover:shadow-md`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-bold text-slate-900">{order.orderNumber}</p>
        <p className="text-xs text-slate-400">Placed on {formatOrderDate(order.orderPlacedAt)}</p>
      </div>
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        {order.currentStepName}
      </span>
    </div>
    <div className="mt-3 flex items-center justify-between">
      <span className="text-xs text-slate-500">Grand total</span>
      <span className={`text-sm font-bold ${theme.card.price}`}>{formatOrderMoney(order, order.grandTotal)}</span>
    </div>
  </button>
);

export default OrderCard;
