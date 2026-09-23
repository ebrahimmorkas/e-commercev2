import { useCallback, useEffect, useState } from 'react';
import { getOrderCurrency } from '../api/adminPlaceOrderApi';
import { formatCurrencyAmount, convertAmount } from '../../../../utils/money';

/**
 * The currency an admin-placed order will be in - the chosen customer's own
 * country's currency (converted from the store currency at the current rate),
 * or the store currency for a walk-in / before a customer is picked. The page
 * shows every amount in it, and the admin types discount, shipping and a
 * manual tax in it (backend adminPlaceOrderService.resolveAdminOrderCurrency).
 *
 * Conversion mirrors the backend exactly: a store-currency unit price is
 * converted first, and a line amount is that converted price x quantity.
 *
 * @param {string} userId - The chosen customer ('' for none).
 * @param {boolean} isWalkIn
 */
export const useOrderCurrency = (userId, isWalkIn) => {
  const requestUserId = !isWalkIn && userId ? userId : '';
  const [state, setState] = useState({ key: null, currency: null, exchangeRate: 1 });

  useEffect(() => {
    let cancelled = false;
    getOrderCurrency(requestUserId || undefined)
      .then((result) => {
        if (!cancelled) setState({ key: requestUserId, currency: result?.currency || null, exchangeRate: result?.exchangeRate || 1 });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestUserId, currency: null, exchangeRate: 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [requestUserId]);

  const { currency, exchangeRate } = state;
  const decimals = typeof currency?.decimalPlaces === 'number' ? currency.decimalPlaces : 2;

  /** Store-currency amount -> order currency. */
  const toOrder = useCallback((storeAmount) => convertAmount(storeAmount, exchangeRate, decimals), [exchangeRate, decimals]);
  /** A line's amount in the order currency, from its store-currency unit price. */
  const lineAmount = useCallback(
    (storeUnitPrice, quantity) => Math.round(toOrder(storeUnitPrice) * quantity * 10 ** decimals) / 10 ** decimals,
    [toOrder, decimals]
  );
  /** Formats an amount that is already in the order currency. */
  const formatMoney = useCallback((orderAmount) => formatCurrencyAmount(orderAmount, currency), [currency]);

  return {
    currency,
    code: currency?.code || '',
    isLoading: state.key !== requestUserId,
    toOrder,
    lineAmount,
    formatMoney,
  };
};

export default useOrderCurrency;
