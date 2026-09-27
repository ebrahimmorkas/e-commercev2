import { useState } from 'react';
import Card from '../../../../components/common/Card';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import { formatCurrencyAmount } from '../../../../utils/money';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import LiveIndicator from '../../../realtime/LiveIndicator';

const VIEWS = [
  { key: 'pending', label: 'To deliver' },
  { key: 'done', label: 'Delivered' },
];

const money = (order, amount) =>
  formatCurrencyAmount(amount, {
    code: order.currencyCode,
    symbol: order.currencySymbol || '',
    symbolPosition: order.currencySymbolPosition,
    decimalPlaces: order.currencyDecimalPlaces ?? 2,
  });

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const digitsOnly = (phone) => (phone || '').replace(/[^\d]/g, '');

const DeliveryCard = ({ order, view, submitting, onStepChange }) => {
  const collect = order.amountToCollect > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">Order #{order.orderNumber}</p>
          <p className="text-xs text-gray-500">
            {view === 'done' ? `Done ${formatDateTime(order.transitionAt)}` : `Assigned ${formatDateTime(order.assignedAt)}`}
          </p>
        </div>
        <Badge variant="blue" size="sm">{order.currentStepName}</Badge>
      </div>

      <div className="text-sm">
        <p className="font-medium text-gray-900">{order.customer?.name || 'Customer'}</p>
        <div className="flex flex-wrap gap-3 mt-1">
          {order.customer?.phone && (
            <a className="text-blue-600 hover:underline" href={`tel:${order.customer.phone}`}>
              Call {order.customer.phone}
            </a>
          )}
          {(order.customer?.whatsapp || order.customer?.phone) && (
            <a className="text-green-700 hover:underline" href={`https://wa.me/${digitsOnly(order.customer.whatsapp || order.customer.phone)}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
        {order.address ? (
          <p className="mt-2 whitespace-pre-line text-gray-700">{order.address}</p>
        ) : (
          <p className="mt-2 text-gray-400">No delivery address on this order - call the customer.</p>
        )}
      </div>

      {order.items?.length > 0 && (
        <ul className="text-sm text-gray-700 border-t border-gray-100 pt-2 space-y-0.5">
          {order.items.map((item, index) => (
            <li key={`${item.sku}-${index}`} className="flex justify-between gap-2">
              <span className="truncate">
                {item.productName} - {item.variantName} - {item.sizeName}
              </span>
              <span className="shrink-0 font-medium">x {item.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={`rounded-lg px-3 py-2 text-sm ${collect ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-gray-50 text-gray-600'}`}>
        {collect ? (
          <span>
            Collect <span className="font-bold">{money(order, order.amountToCollect)}</span> from the customer
          </span>
        ) : order.paymentStatus === 'PAID' ? (
          'Already paid - nothing to collect'
        ) : (
          `Order total ${money(order, order.grandTotal)} - payment is handled by the store`
        )}
      </div>

      {order.remarks && <p className="text-xs text-gray-500">Note from the store: {order.remarks}</p>}

      {view === 'pending' && order.stepChange && (
        <div className="pt-1">
          <Button variant="primary" fullWidth disabled={!order.canMakeStepChange} loading={submitting} onClick={() => onStepChange(order)}>
            Mark &quot;{order.stepChange.toStepName}&quot;
          </Button>
          {!order.canMakeStepChange && (
            <p className="mt-1 text-xs text-gray-500">Available once the store moves this order to &quot;{order.stepChange.fromStepName}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * The only page a delivery agent sees: the orders assigned to them, and the
 * store's one step change they can make on each (e.g. Dispatched -> Delivered).
 */
const MyDeliveriesPage = () => {
  const [view, setView] = useState('pending');
  const { orders, loading, error, submittingId, makeStepChange } = useMyDeliveries(view);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    await makeStepChange(confirmTarget);
    setConfirmTarget(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">My Deliveries</span>}
        subtitle="Orders your store has assigned to you - this page updates by itself"
        headerActions={<LiveIndicator />}
      >
        <div className="flex gap-2 mb-4">
          {VIEWS.map((item) => (
            <Button key={item.key} variant={view === item.key ? 'primary' : 'ghost'} size="sm" onClick={() => setView(item.key)}>
              {item.label}
            </Button>
          ))}
        </div>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title={view === 'pending' ? 'Nothing to deliver right now' : 'No deliveries yet'}
            description={view === 'pending' ? 'Orders your store assigns to you will show up here.' : 'Orders you deliver will show up here.'}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <DeliveryCard key={order._id} order={order} view={view} submitting={submittingId === order._id} onStepChange={setConfirmTarget} />
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={`Mark "${confirmTarget?.stepChange?.toStepName || ''}"?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmTarget(null)} disabled={!!submittingId}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} loading={!!submittingId}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Order #{confirmTarget?.orderNumber} will be marked &quot;{confirmTarget?.stepChange?.toStepName}&quot;. This can&apos;t be undone.
          {confirmTarget?.amountToCollect > 0 && (
            <>
              {' '}
              Confirm you collected <span className="font-semibold text-gray-900">{money(confirmTarget, confirmTarget.amountToCollect)}</span> - the payment will be marked as done.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
};

export default MyDeliveriesPage;
