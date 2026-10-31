import { useEffect, useMemo, useState } from 'react';
import { getCart } from '../../cart/api/cartApi';
import { flattenCartLineItems } from '../../cart/utils/shapeCart';
import { formatCurrencyAmount, convertAmount } from '../../../../utils/money';

/**
 * The cart priced for delivery to the chosen saved address. With international
 * pricing on, the delivery country decides local vs international prices (and
 * the currency) - so a shopper browsing from abroad who ships home pays local
 * prices, and the other way round. Same rule the order is placed with
 * (backend orderService.createOrderFromCart).
 *
 * Returns null until priced (or with no address); the checkout then keeps
 * showing the cart as loaded on the cart page.
 *
 * @param {string|null} addressId
 * @param {string} refreshKey - Changes whenever the cart itself changes.
 * @returns {null | { lineItems, subtotal, totalDiscountAmount, totalFreeCashAmount,
 *   currency, isInternationalPrice, formatMoney }}
 */
export const useDeliveryPricing = (addressId, refreshKey) => {
  const [result, setResult] = useState({ key: null, data: null });
  const requestKey = addressId ? `${addressId}|${refreshKey}` : null;

  useEffect(() => {
    if (!requestKey) return undefined;
    let cancelled = false;
    getCart({ addressId })
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data });
      })
      .catch(() => {
        // Best effort - the checkout falls back to the cart page's prices,
        // and the order is priced server-side either way.
        if (!cancelled) setResult({ key: requestKey, data: null });
      });
    return () => {
      cancelled = true;
    };
    // requestKey already covers addressId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return useMemo(() => {
    const data = result.key === requestKey ? result.data : null;
    if (!data?.cart || !data.currency) return null;
    const lineItems = flattenCartLineItems(data.cart);
    const { currency, exchangeRate = 1 } = data.currency;
    const decimals = typeof currency?.decimalPlaces === 'number' ? currency.decimalPlaces : 2;
    return {
      lineItems,
      subtotal: lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      totalDiscountAmount: data.cart.totalDiscountAmount || 0,
      totalFreeCashAmount: data.cart.totalFreeCashAmount || 0,
      currency,
      isInternationalPrice: data.currency.isInternationalPrice === true,
      // Store-currency amount -> shown in the delivery address's currency.
      formatMoney: (storeAmount) => formatCurrencyAmount(convertAmount(storeAmount, exchangeRate, decimals), currency),
    };
  }, [result, requestKey]);
};

export default useDeliveryPricing;
