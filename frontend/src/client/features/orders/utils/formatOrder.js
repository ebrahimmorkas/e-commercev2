import { formatCurrencyAmount } from '../../../../utils/money';

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
export const formatOrderMoney = (order, amount) =>
  formatCurrencyAmount(amount, {
    code: order?.currencyCode,
    symbol: order?.currencySymbol || '',
    symbolPosition: order?.currencySymbolPosition,
    decimalPlaces: order?.currencyDecimalPlaces ?? 2,
  });

// Shipping row text for a placed order. Orders placed from the storefront
// carry a shippingPriceBreakdown (see backend Order model); admin-placed ones
// don't (their shipping is typed in manually), so those just show the amount.
export const formatOrderShipping = (order) => {
  if (order?.shippingPriceBreakdown?.isShippingPending) return 'To be confirmed';
  if (order?.shippingPriceBreakdown && !order.shippingAmount) return 'Free';
  return formatOrderMoney(order, order?.shippingAmount);
};

export const formatOrderDate = (dateValue) => {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
