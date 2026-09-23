import { createContext } from 'react';

/**
 * @type {import('react').Context<{
 *   currency: Object|null, storeCurrency: Object|null, exchangeRate: number,
 *   convert: (storeAmount: number) => number,
 *   formatMoney: (storeAmount: number) => string,
 *   formatConverted: (amount: number) => string,
 * } | null>}
 */
export const CurrencyContext = createContext(null);
