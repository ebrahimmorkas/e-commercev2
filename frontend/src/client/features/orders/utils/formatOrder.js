// Mirrors backend/constants/orderStepConstants.js's RESERVED_STEP_CODES/
// TERMINAL_STEP_CODES - just the two used for the cancel-button UI gate.
// The backend is still the authority: cancelOrder re-validates cutoff step,
// isOrderCancellationAllowed, etc. server-side regardless of what this shows.
export const TERMINAL_STEP_CODES = ['COMPLETED', 'DELIVERED'];
export const REJECTED_STEP_CODE = 'REJECTED';

export const isOrderCancellable = (order) =>
  !!order && !TERMINAL_STEP_CODES.includes(order.currentStepCode) && order.currentStepCode !== REJECTED_STEP_CODE;

// Order snapshots its own currency at creation time (currencySymbol/
// currencySymbolPosition/currencyDecimalPlaces) so historical orders always
// render with the currency they were actually placed in.
export const formatOrderMoney = (order, amount) => {
  const value = (amount ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: order?.currencyDecimalPlaces ?? 2,
    maximumFractionDigits: order?.currencyDecimalPlaces ?? 2,
  });
  const symbol = order?.currencySymbol || '';
  return order?.currencySymbolPosition === 'SUFFIX' ? `${value}${symbol}` : `${symbol}${value}`;
};

export const formatOrderDate = (dateValue) => {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
