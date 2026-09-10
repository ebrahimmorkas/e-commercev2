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
