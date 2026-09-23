import { useContext } from 'react';
import { CurrencyContext } from './CurrencyContext';

/**
 * Every storefront price goes through this - never a hardcoded symbol.
 *
 *   const { formatMoney } = useCurrency();
 *   formatMoney(product.price) // store-currency number -> "19.16 AED"
 *
 * formatConverted() formats an amount that is ALREADY in the shopper's
 * currency (e.g. a total added up from converted prices).
 */
export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a <CurrencyProvider>');
  return ctx;
};

export default useCurrency;
