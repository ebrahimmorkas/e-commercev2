/**
 * Money formatting shared by the storefront and the admin panel - the one
 * place a currency symbol is placed, so none is ever hardcoded elsewhere.
 *
 * `currency` is the shape the backend sends (services/currencyService.js
 * shapeCurrency): { code, symbol, symbolPosition: 'PREFIX'|'SUFFIX', decimalPlaces }.
 * Until it has loaded, amounts are shown as plain numbers.
 */

// Indian digit grouping (1,00,000) for rupees, international grouping otherwise.
const localeFor = (code) => (code === 'INR' ? 'en-IN' : 'en-US');

/**
 * @param {number} amount - Already in `currency` (no conversion here).
 * @param {{ code: string, symbol: string, symbolPosition: string, decimalPlaces: number }|null} currency
 */
export const formatCurrencyAmount = (amount, currency) => {
  const decimals = typeof currency?.decimalPlaces === 'number' ? currency.decimalPlaces : 2;
  const value = (Number(amount) || 0).toLocaleString(localeFor(currency?.code), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (!currency?.symbol) return value;
  return currency.symbolPosition === 'SUFFIX' ? `${value} ${currency.symbol}` : `${currency.symbol}${value}`;
};

/**
 * Store-currency amount -> the customer's currency, rounded to its decimals.
 * @param {number} amount
 * @param {number} exchangeRate - customer-currency units per 1 store unit (1 = no conversion)
 * @param {number} [decimalPlaces]
 */
export const convertAmount = (amount, exchangeRate = 1, decimalPlaces = 2) => {
  const factor = 10 ** decimalPlaces;
  return Math.round((Number(amount) || 0) * (exchangeRate || 1) * factor) / factor;
};

export default { formatCurrencyAmount, convertAmount };
