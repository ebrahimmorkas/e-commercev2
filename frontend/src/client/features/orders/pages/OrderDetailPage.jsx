import { useState } from 'react';
import theme from '../../Home/theme/theme';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import Modal from '../../../../components/common/Modal/Modal';
import { useToast } from '../../../../components/common/Toast';
import { useOrder } from '../hooks/useOrder';
import OrderStatusTimeline from '../components/OrderStatusTimeline';
import { formatOrderMoney, formatOrderDate, isOrderCancellable } from '../utils/formatOrder';

const SummaryRow = ({ label, value, bold = false }) => (
  <div className={`flex justify-between text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const AddressBlock = ({ title, snapshot }) => {
  if (!snapshot) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <p className="mt-1 text-sm text-slate-700">
        {snapshot.addressName ? `${snapshot.addressName} · ` : ''}
        {[snapshot.roomNo, snapshot.floor ? `Floor ${snapshot.floor}` : null, snapshot.building]
          .filter(Boolean)
          .join(', ')}
        <br />
        {snapshot.addressInWords}
        <br />
        {[snapshot.cityName, snapshot.stateName, snapshot.countryName].filter(Boolean).join(', ')} -{' '}
        {snapshot.pincode}
      </p>
    </div>
  );
};

/**
 * Single-order view. Backed by GET /api/orders/my-orders/:id, gated behind
 * the store's isOrderTrakingAllowed feature server-side (see
 * orderController.js's getMyOrderById) - a 403 from that feature check
 * surfaces here as the generic error state below.
 */
const OrderDetailPage = ({ orderId, onBack }) => {
  const { order, loading, error, cancelling, cancel } = useOrder(orderId);
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    setCancelError('');
    try {
      await cancel(reason.trim());
      toast.success('Order cancelled');
      setCancelOpen(false);
      setReason('');
    } catch (err) {
      setCancelError(err.message || 'Could not cancel order');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" label="Loading order" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <EmptyState title="Couldn't load this order" description={error || 'Order not found.'} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-4 sm:mb-6"
      >
        ← Back to orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold ${theme.section.heading}`}>{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">Placed on {formatOrderDate(order.orderPlacedAt)}</p>
        </div>
        {isOrderCancellable(order) && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer border border-red-200 text-red-600 hover:bg-red-50"
          >
            Cancel order
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className={`md:col-span-2 rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">Status</h2>
          <OrderStatusTimeline statusHistory={order.statusHistory} />

          <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AddressBlock title="Shipping address" snapshot={order.shippingAddressSnapshot} />
            <AddressBlock title="Billing address" snapshot={order.billingAddressSnapshot} />
          </div>

          {order.cancellationReason && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cancellation reason</h3>
              <p className="mt-1 text-sm text-slate-700">{order.cancellationReason}</p>
            </div>
          )}
        </div>

        <div className={`h-fit rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Order Summary</h2>
          <div className="space-y-1.5">
            <SummaryRow label="Subtotal" value={formatOrderMoney(order, order.subtotal)} />
            {order.totalDiscountAmount > 0 && (
              <SummaryRow label="Discount" value={`- ${formatOrderMoney(order, order.totalDiscountAmount)}`} />
            )}
            {order.totalFreeCashAmount > 0 && (
              <SummaryRow label="Free cash used" value={`- ${formatOrderMoney(order, order.totalFreeCashAmount)}`} />
            )}
            <SummaryRow label="Tax" value={formatOrderMoney(order, order.totalTaxAmount)} />
            <SummaryRow label="Shipping" value={formatOrderMoney(order, order.shippingAmount)} />
            {order.additionalCharges > 0 && (
              <SummaryRow label="Additional charges" value={formatOrderMoney(order, order.additionalCharges)} />
            )}
          </div>
          <div className="mt-2 pt-3 border-t border-slate-200">
            <SummaryRow label="Grand total" value={formatOrderMoney(order, order.grandTotal)} bold />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
            <span>Payment</span>
            <span className="font-medium text-slate-700">{order.payment?.status || 'PENDING'}</span>
          </div>
        </div>
      </div>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?" size="sm">
        {cancelError && (
          <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
            {cancelError}
          </div>
        )}
        <form onSubmit={handleCancelSubmit} className="space-y-3">
          <textarea
            placeholder="Tell us why you're cancelling"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-24 resize-none outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            required
            minLength={1}
            maxLength={500}
            disabled={cancelling}
          />
          <button
            type="submit"
            disabled={cancelling}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-red-600 hover:bg-red-700 text-white transition-colors duration-150 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default OrderDetailPage;
