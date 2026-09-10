import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { useOrderAdmin } from '../hooks/useOrderAdmin';
import OrderStatusTimeline from './OrderStatusTimeline';
import AdvanceStepForm from './AdvanceStepForm';
import AssignDeliveryAgentForm from './AssignDeliveryAgentForm';
import { formatOrderMoney, formatOrderDateTime, stepBadgeVariant, isOrderLocked } from '../utils/formatOrder';
import theme from '../theme/theme';

const SummaryRow = ({ label, value, bold = false }) => (
  <div className={`flex justify-between text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const AddressBlock = ({ title, snapshot }) => {
  if (!snapshot) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <p className="mt-1 text-sm text-gray-700">
        {snapshot.addressName ? `${snapshot.addressName} · ` : ''}
        {[snapshot.roomNo, snapshot.floor ? `Floor ${snapshot.floor}` : null, snapshot.building].filter(Boolean).join(', ')}
        <br />
        {snapshot.addressInWords}
        <br />
        {[snapshot.cityName, snapshot.stateName, snapshot.countryName].filter(Boolean).join(', ')} - {snapshot.pincode}
      </p>
    </div>
  );
};

/**
 * Admin order detail: status timeline, addresses, totals, and the two admin
 * actions (advance step, assign delivery agent). Backed by
 * GET/PATCH /api/orders/admin/... (orderAdminApi.js).
 */
const OrderDetailModal = ({ orderId, onClose, onChanged }) => {
  const { order, stepOptions, loading, error, mutating, advanceStep, assignAgent } = useOrderAdmin(orderId);
  const [activeForm, setActiveForm] = useState(null); // null | 'advance' | 'assign'

  const handleAdvance = async (targetStepCode, remarks) => {
    const success = await advanceStep(targetStepCode, remarks);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleAssign = async (deliveryAgentUserId) => {
    const success = await assignAgent(deliveryAgentUserId);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  return (
    <Modal isOpen={!!orderId} onClose={onClose} title={order ? order.orderNumber : 'Order'} size="lg">
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && error && <p className={`text-sm ${theme.alert.error.text}`}>{error}</p>}

      {!loading && order && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">Placed on {formatOrderDateTime(order.orderPlacedAt)}</p>
              {order.assignedDeliveryAgentId && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Delivery agent assigned {formatOrderDateTime(order.deliveryAgentAssignedAt)}
                </p>
              )}
            </div>
            <Badge variant={stepBadgeVariant(order.currentStepCode)} size="lg">
              {order.currentStepName}
            </Badge>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Status history</h3>
            <OrderStatusTimeline statusHistory={order.statusHistory} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <AddressBlock title="Shipping address" snapshot={order.shippingAddressSnapshot} />
            <AddressBlock title="Billing address" snapshot={order.billingAddressSnapshot} />
          </div>

          {order.cancellationReason && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cancellation reason</h4>
              <p className="mt-1 text-sm text-gray-700">{order.cancellationReason}</p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 space-y-1.5">
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
            <div className="pt-2 mt-2 border-t border-gray-200">
              <SummaryRow label="Grand total" value={formatOrderMoney(order, order.grandTotal)} bold />
            </div>
            <div className="flex justify-between text-xs text-gray-500 pt-1">
              <span>Payment</span>
              <span className="font-medium text-gray-700">{order.payment?.status || 'PENDING'}</span>
            </div>
          </div>

          {isOrderLocked(order) ? (
            <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
              This order has reached a terminal step and can no longer be updated.
            </p>
          ) : (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              {activeForm === 'advance' ? (
                <AdvanceStepForm
                  stepOptions={stepOptions}
                  currentStepCode={order.currentStepCode}
                  onSubmit={handleAdvance}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'assign' ? (
                <AssignDeliveryAgentForm onSubmit={handleAssign} onCancel={() => setActiveForm(null)} submitting={mutating} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant={theme.button.primary} onClick={() => setActiveForm('advance')}>
                    Advance step
                  </Button>
                  <Button variant={theme.button.secondary} onClick={() => setActiveForm('assign')}>
                    Assign delivery agent
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default OrderDetailModal;
