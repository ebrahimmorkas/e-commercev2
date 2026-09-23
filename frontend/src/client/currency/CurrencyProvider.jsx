import { useEffect, useMemo, useState } from 'react';
import { CurrencyContext } from './CurrencyContext';
import { getCurrencyContext } from './currencyApi';
import { useAuth } from '../features/auth/hooks/useAuth';
import { formatCurrencyAmount, convertAmount } from '../../utils/money';

/**
 * Loads which currency the shopper sees (backend services/currencyService.js:
 * their country's currency when it's one the store serves and a fresh rate
 * exists, else the store currency) and re-loads it on login/logout, since
 * those set/clear the Country cookie it's based on. Prices arrive from the API
 * in the store currency and are converted for display with exactly this rate -
 * the same rate a placed order is converted at.
 */
const CurrencyProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [context, setContext] = useState(null);
  const userKey = isAuthenticated ? user?._id || 'user' : 'guest';

  useEffect(() => {
    let cancelled = false;
    getCurrencyContext()
      .then((result) => {
        if (!cancelled) setContext(result || null);
      })
      .catch(() => {
        // Store currency unknown too - amounts render as plain numbers.
        if (!cancelled) setContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const value = useMemo(() => {
    const currency = context?.currency || null;
    const exchangeRate = context?.exchangeRate || 1;
    const decimals = typeof currency?.decimalPlaces === 'number' ? currency.decimalPlaces : 2;
    const convert = (storeAmount) => convertAmount(storeAmount, exchangeRate, decimals);
    return {
      currency,
      storeCurrency: context?.storeCurrency || null,
      exchangeRate,
      convert,
      formatMoney: (storeAmount) => formatCurrencyAmount(convert(storeAmount), currency),
      formatConverted: (amount) => formatCurrencyAmount(amount, currency),
    };
  }, [context]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export default CurrencyProvider;
