import { formatCurrencyAmount } from '../../../../utils/money';

// Badge colours for backend/constants/orderStepConstants.js's built-in step
// codes. Any OTHER step code is a vendor-custom step with no special styling.
// Whether an order is finalized (on its workflow's last step) or closed
// (rejected/cancelled/refunded) comes from the server: order.isFinalized /
// order.isClosed - never worked out from the step code here.
const STEP_BADGE_VARIANTS = {
  ACCEPTED: 'blue',
  REJECTED: 'red',
  CANCELLED: 'red',
  REFUNDED: 'gray',
  PAYMENT_AT_DELIVERY: 'purple',
  READY_FOR_DELIVERY: 'purple',
  DISPATCHED: 'yellow',
  DELIVERED: 'green',
  COMPLETED: 'green',
};

export const stepBadgeVariant = (stepCode) => STEP_BADGE_VARIANTS[stepCode] || 'gray';

// Where an order came from. Walk-in (cash counter) orders have no user, so the
// typed customer name (or a generic label) is what identifies them.
export const orderSourceLabel = (order) => {
  if (order?.isWalkInCustomer) return `Walk-in: ${order.walkInCustomer?.name || 'Customer'}`;
  if (order?.isPlacedByAdmin) return 'Placed by admin';
  return 'Online';
};

export const orderSourceVariant = (order) => {
  if (order?.isWalkInCustomer) return 'purple';
  if (order?.isPlacedByAdmin) return 'blue';
  return 'gray';
};

// On the last step of its workflow: nothing at all can be done to it any more.
export const isOrderLocked = (order) => !!order && order.isFinalized === true;

// Rejected, cancelled or refunded: only Refund / Restart are possible.
export const isOrderClosed = (order) => !!order && order.isClosed === true;

// Order snapshots its own currency at creation time, so historical orders
// always render with the currency they were actually placed in.
export const formatOrderMoney = (order, amount) =>
  formatCurrencyAmount(amount, {
    code: order?.currencyCode,
    symbol: order?.currencySymbol || '',
    symbolPosition: order?.currencySymbolPosition,
    decimalPlaces: order?.currencyDecimalPlaces ?? 2,
  });

// Whether an order's already-set shipping price may still be edited: it has a
// price (not waiting for its first one) and no payment has been taken. The
// backend re-checks this (orderService.updateOrderShippingPrice).
export const canEditShipping = (order) =>
  !!order &&
  !order.shippingPriceBreakdown?.isShippingPending &&
  ['PENDING', 'FAILED'].includes(order.payment?.status || 'PENDING');

// Whether products may still be added to an order: not finalized, cancelled or
// rejected, and no payment taken yet. The backend re-checks this.
export const canEditOrderFor = (order) =>
  !!order &&
  !isOrderLocked(order) &&
  !isOrderClosed(order) &&
  !order.cancelledAt &&
  ['PENDING', 'FAILED'].includes(order.payment?.status || 'PENDING');

// Whether an order's delivery address may still be changed: not finalized,
// cancelled or rejected. The backend re-checks this.
export const canEditShippingAddressFor = (order) =>
  !!order && !isOrderLocked(order) && !isOrderClosed(order) && !order.cancelledAt;

// Shipping row text for a placed order. Orders placed from the storefront
// carry a shippingPriceBreakdown (see backend Order model); admin-placed ones
// don't (their shipping is typed in manually), so those just show the amount.
export const formatOrderShipping = (order) => {
  if (order?.shippingPriceBreakdown?.isShippingPending) return 'To be confirmed';
  if (order?.shippingPriceBreakdown && !order.shippingAmount) return 'Free';
  return formatOrderMoney(order, order?.shippingAmount);
};

export const formatOrderDateTime = (dateValue) => {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
