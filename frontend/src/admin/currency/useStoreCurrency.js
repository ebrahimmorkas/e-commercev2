import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import { formatCurrencyAmount } from '../../utils/money';

// Loaded once per page load and shared by every admin screen. Only a success
// is cached, so a call made before login (401) is simply retried later.
let storeCurrencyPromise = null;
const loadStoreCurrency = () => {
  if (!storeCurrencyPromise) {
    storeCurrencyPromise = apiRequest('/currency/store')
      .then((result) => ({ currency: result?.currency || null, internationalCurrency: result?.internationalCurrency || null }))
      .catch((err) => {
        storeCurrencyPromise = null;
        throw err;
      });
  }
  return storeCurrencyPromise;
};

/**
 * The store currency (Company Settings) every admin amount is entered and
 * shown in - admin screens never hardcode a symbol.
 *
 *   const { formatMoney, symbol } = useStoreCurrency();
 *   formatMoney(499)            // "₹499.00"
 *   `Amount (${symbol})`        // field labels
 *
 * internationalCurrency is set only while international pricing is on for the
 * vendor (CompanyMaster.internationalCurrency) - the international price
 * fields are shown only then.
 *
 * @returns {{ currency: Object|null, symbol: string, formatMoney: (amount: number) => string,
 *   internationalCurrency: Object|null }}
 */
export const useStoreCurrency = () => {
  const [state, setState] = useState({ currency: null, internationalCurrency: null });

  useEffect(() => {
    let cancelled = false;
    loadStoreCurrency()
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { currency, internationalCurrency } = state;
  // Stable until the currency loads, so memoized tables can list it as a dependency.
  const formatMoney = useCallback((amount) => formatCurrencyAmount(amount, currency), [currency]);

  return { currency, symbol: currency?.symbol || '', formatMoney, internationalCurrency };
};

export default useStoreCurrency;
