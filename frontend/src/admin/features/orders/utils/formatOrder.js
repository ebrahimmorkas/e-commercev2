// Mirrors backend/constants/orderStepConstants.js's RESERVED_STEP_CODES/
// TERMINAL_STEP_CODES for badge coloring and the cancel/advance gates below.
// Any OTHER step code is a vendor-custom step with no special styling.
export const TERMINAL_STEP_CODES = ['COMPLETED', 'DELIVERED'];

const STEP_BADGE_VARIANTS = {
  ACCEPTED: 'blue',
  REJECTED: 'red',
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

export const isOrderLocked = (order) => !!order && TERMINAL_STEP_CODES.includes(order.currentStepCode);

// Order snapshots its own currency at creation time, so historical orders
// always render with the currency they were actually placed in.
export const formatOrderMoney = (order, amount) => {
  const value = (amount ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: order?.currencyDecimalPlaces ?? 2,
    maximumFractionDigits: order?.currencyDecimalPlaces ?? 2,
  });
  const symbol = order?.currencySymbol || '';
  return order?.currencySymbolPosition === 'SUFFIX' ? `${value}${symbol}` : `${symbol}${value}`;
};

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
  order.currentStepCode !== 'REJECTED' &&
  !order.cancelledAt &&
  ['PENDING', 'FAILED'].includes(order.payment?.status || 'PENDING');

// Whether an order's delivery address may still be changed: not finalized,
// cancelled or rejected. The backend re-checks this.
export const canEditShippingAddressFor = (order) =>
  !!order && !isOrderLocked(order) && order.currentStepCode !== 'REJECTED' && !order.cancelledAt;

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
