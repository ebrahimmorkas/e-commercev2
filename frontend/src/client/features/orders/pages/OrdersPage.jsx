import theme from '../../Home/theme/theme';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useOrders } from '../hooks/useOrders';
import OrderCard from '../components/OrderCard';

/**
 * My Orders list. Backed by GET /api/orders/my-orders (login required - see
 * ordersApi.js).
 */
const OrdersPage = ({ onBack, onOpenOrder }) => {
  const { orders, loading, error, reload } = useOrders();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-4 sm:mb-6"
      >
        ← Continue shopping
      </button>

      <h1 className={`text-xl sm:text-2xl font-bold ${theme.section.heading}`}>My Orders</h1>

      {loading && (
        <div className="flex justify-center py-24">
          <Spinner size="lg" label="Loading orders" />
        </div>
      )}

      {!loading && error && (
        <EmptyState
          title="Couldn't load your orders"
          description={error}
          action={
            <button
              type="button"
              onClick={reload}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Try Again
            </button>
          }
        />
      )}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="No orders yet"
          description="Orders you place will show up here."
          action={
            <button
              type="button"
              onClick={onBack}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Start Shopping
            </button>
          }
        />
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <OrderCard key={order._id} order={order} onClick={() => onOpenOrder(order._id)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
