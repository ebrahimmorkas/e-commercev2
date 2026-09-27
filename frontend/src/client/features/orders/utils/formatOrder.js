import { formatCurrencyAmount } from '../../../../utils/money';

// Decided by the server (order.canBeCancelled - the same check cancelOrder
// makes: the store allows it, the order isn't closed or on its last step, and
// it hasn't reached the store's cancellation cutoff step).
export const isOrderCancellable = (order) => !!order && order.canBeCancelled === true;

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
