import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { useOrderAdmin } from '../hooks/useOrderAdmin';
import { useInvoiceDownload } from '../../../../hooks/useInvoiceDownload';
import { downloadInvoiceAdmin, downloadCreditNoteAdmin } from '../api/orderAdminApi';
import OrderStatusTimeline from './OrderStatusTimeline';
import OrderItems from './OrderItems';
import AdvanceStepForm from './AdvanceStepForm';
import AssignDeliveryAgentForm from './AssignDeliveryAgentForm';
import ChangeDeliveryDateForm from './ChangeDeliveryDateForm';
import { orderDeliveryDateValue } from '../utils/deliveryDate';
import DeliveryAgentSection from './DeliveryAgentSection';
import CourierSection from './CourierSection';
import AddShippingPriceForm from './AddShippingPriceForm';
import EditShippingAddressForm from './EditShippingAddressForm';
import EditOrderForm from './EditOrderForm';
import { formatOrderMoney, formatOrderShipping, canEditShipping, canEditShippingAddressFor, canEditOrderFor, formatOrderDateTime, stepBadgeVariant, isOrderLocked, isOrderClosed, orderSourceLabel, orderSourceVariant } from '../utils/formatOrder';
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

// Customer contact details (order.customer, sent by the admin order API):
// the account's current details, or for a walk-in order what the admin typed
// at the cash counter (plus the typed address). Blank fields are skipped.
const CustomerBlock = ({ order }) => {
  const customer = order.customer;
  if (!customer) return null;
  const rows = [
    ['Name', customer.name],
    ['Email', customer.email],
    ['Phone', customer.phone],
    ['WhatsApp', customer.whatsapp],
    ['Address', order.isWalkInCustomer ? order.walkInCustomer?.address : null],
  ].filter(([, value]) => value);
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {order.isWalkInCustomer ? 'Walk-in customer' : 'Customer'}
      </h4>
      {/* Label above value, and long values (emails) wrap, so nothing spills into the next column. */}
      <dl className="mt-1 text-sm text-gray-700 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * Admin order detail: status timeline, addresses, totals, and the two admin
 * actions (advance step, assign delivery agent). Backed by
 * GET/PATCH /api/orders/admin/... (orderAdminApi.js).
 */
const OrderDetailModal = ({ orderId, onClose, onChanged }) => {
  const { order, stepOptions, loading, error, mutating, advanceStep, assignAgent, unassignAgent, changeDate, saveCourier, addShippingPrice, editShippingPrice, canEditShippingPrice, canEditShippingAddress, loadUserAddresses, editShippingAddress, canEditOrder, addProducts } = useOrderAdmin(orderId);
  const { download: downloadInvoice, downloading: downloadingInvoice } = useInvoiceDownload(downloadInvoiceAdmin);
  const { download: downloadCreditNote, downloading: downloadingCreditNote } = useInvoiceDownload(downloadCreditNoteAdmin);
  const [activeForm, setActiveForm] = useState(null); // null | 'advance' | 'assign' | 'deliveryDate' | 'shipping' | 'editShipping' | 'editAddress' | 'editOrder'

  const handleAdvance = async (targetStepCode, remarks) => {
    const success = await advanceStep(targetStepCode, remarks);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleAddShipping = async (shippingAmount) => {
    const success = await addShippingPrice(shippingAmount);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleEditShipping = async (shippingAmount) => {
    const success = await editShippingPrice(shippingAmount);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleEditAddress = async (payload) => {
    const success = await editShippingAddress(payload);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleAddProducts = async (items, applyBulkPricing, manualTaxAmount) => {
    const success = await addProducts(items, applyBulkPricing, manualTaxAmount);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleUnassign = async () => {
    const success = await unassignAgent();
    if (success) onChanged?.();
    return success;
  };

  const handleSaveCourier = async (courierId) => {
    const success = await saveCourier(courierId);
    if (success) onChanged?.();
    return success;
  };

  const handleChangeDeliveryDate = async (deliveryDate) => {
    const success = await changeDate(deliveryDate);
    if (success) {
      setActiveForm(null);
      onChanged?.();
    }
    return success;
  };

  const handleAssign = async (deliveryAgentUserId, deliveryDate) => {
    const success = await assignAgent(deliveryAgentUserId, deliveryDate);
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
            </div>
            <div className="flex items-center gap-2">
              {/* Decided by the server: feature on, order invoiceable (older orders and never-invoiced cancelled orders are not). */}
              {order.invoiceDownloadable && (
                <Button variant={theme.button.secondary} size="sm" onClick={() => downloadInvoice(order._id)} loading={downloadingInvoice}>
                  Download invoice{order.invoiceNumber ? ` (${order.invoiceNumber})` : ''}
                </Button>
              )}
              {order.creditNoteDownloadable && (
                <Button variant={theme.button.secondary} size="sm" onClick={() => downloadCreditNote(order._id)} loading={downloadingCreditNote}>
                  Download credit note
                </Button>
              )}
              <Badge variant={stepBadgeVariant(order.currentStepCode)} size="lg">
                {order.currentStepName}
              </Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Status history</h3>
            <OrderStatusTimeline statusHistory={order.statusHistory} />
          </div>

          <DeliveryAgentSection order={order} />

          {/* Keyed by the saved courier so the checkbox/dropdown reset to it after every save. */}
          <CourierSection key={order.courierId || 'none'} order={order} onSave={handleSaveCourier} saving={mutating} />

          {order.items?.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <OrderItems order={order} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            {order.isPlacedByAdmin && (
              <div className="sm:col-span-2">
                <Badge variant={orderSourceVariant(order)}>{orderSourceLabel(order)}</Badge>
              </div>
            )}
            <CustomerBlock order={order} />
            <AddressBlock title="Shipping address" snapshot={order.shippingAddressSnapshot} />
            {order.adminEnteredAddress && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery address (typed by admin)</h4>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{order.adminEnteredAddress}</p>
              </div>
            )}
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
            <SummaryRow label="Shipping" value={formatOrderShipping(order)} />
            {order.shippingPriceBreakdown?.isShippingPending && (
              <p className="text-xs text-amber-600">Shipping price is not added yet - the total above excludes it.</p>
            )}
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
              This order has reached the last step of its workflow and can no longer be updated.
            </p>
          ) : (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              {activeForm === 'advance' ? (
                <AdvanceStepForm
                  stepOptions={stepOptions}
                  onSubmit={handleAdvance}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'shipping' ? (
                <AddShippingPriceForm
                  currencySymbol={order.currencySymbol}
                  onSubmit={handleAddShipping}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'editShipping' ? (
                <AddShippingPriceForm
                  key="edit-shipping"
                  initialAmount={order.shippingAmount}
                  submitLabel="Update shipping price"
                  hint="The order total is recalculated with the new shipping price."
                  currencySymbol={order.currencySymbol}
                  onSubmit={handleEditShipping}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'editOrder' ? (
                <EditOrderForm
                  order={order}
                  onSubmit={handleAddProducts}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'editAddress' ? (
                <EditShippingAddressForm
                  order={order}
                  loadAddresses={loadUserAddresses}
                  onSubmit={handleEditAddress}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'assign' ? (
                <AssignDeliveryAgentForm
                  currentAgentId={order.assignedDeliveryAgentId}
                  currentDeliveryDate={order.assignedDeliveryAgentId ? orderDeliveryDateValue(order) : ''}
                  onSubmit={handleAssign}
                  onCancel={() => setActiveForm(null)}
                  submitting={mutating}
                />
              ) : activeForm === 'deliveryDate' ? (
                <ChangeDeliveryDateForm order={order} onSubmit={handleChangeDeliveryDate} onCancel={() => setActiveForm(null)} submitting={mutating} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stepOptions.length > 0 && (
                    <Button variant={theme.button.primary} onClick={() => setActiveForm('advance')}>
                      {isOrderClosed(order) ? 'Refund / Restart' : 'Update status'}
                    </Button>
                  )}
                  {order.shippingPriceBreakdown?.isShippingPending && !isOrderClosed(order) && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('shipping')}>
                      Add Shipping price
                    </Button>
                  )}
                  {canEditShippingPrice && canEditShipping(order) && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('editShipping')}>
                      Edit Shipping Price
                    </Button>
                  )}
                  {canEditOrder && canEditOrderFor(order) && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('editOrder')}>
                      Edit Order
                    </Button>
                  )}
                  {canEditShippingAddress && canEditShippingAddressFor(order) && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('editAddress')}>
                      Edit Shipping Address
                    </Button>
                  )}
                  {/* Server-decided: agent access on, the agent step change set in Company Settings, order still active. */}
                  {order.canAssignDeliveryAgent && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('assign')}>
                      {order.assignedDeliveryAgentId ? 'Change delivery agent' : 'Assign delivery agent'}
                    </Button>
                  )}
                  {order.canAssignDeliveryAgent && order.assignedDeliveryAgentId && (
                    <Button variant={theme.button.secondary} onClick={() => setActiveForm('deliveryDate')}>
                      Change delivery date
                    </Button>
                  )}
                  {order.canAssignDeliveryAgent && order.assignedDeliveryAgentId && (
                    <Button variant={theme.button.ghost} onClick={handleUnassign} loading={mutating && activeForm === null}>
                      Remove delivery agent
                    </Button>
                  )}
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
