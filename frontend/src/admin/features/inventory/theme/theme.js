/**
 * Central color theme for the Inventory feature. Every component in this
 * feature pulls its colors (and variant choices for shared components) from
 * here instead of hardcoding them inline. To re-theme this feature, edit this
 * file only.
 */
const theme = {
  text: {
    heading: 'text-gray-900',
    body: 'text-gray-600',
    muted: 'text-gray-400',
    error: 'text-red-600',
  },
  alert: {
    error: {
      background: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
  },
  // Stock level -> Badge variant, the color of the stock number, and the
  // summary tile shown above the table.
  stockLevel: {
    IN_STOCK: { badge: 'green', number: 'text-gray-900', tile: 'border-green-200 bg-green-50 text-green-800' },
    LOW_STOCK: { badge: 'yellow', number: 'text-amber-600', tile: 'border-amber-300 bg-amber-50 text-amber-800' },
    OUT_OF_STOCK: { badge: 'red', number: 'text-red-600', tile: 'border-red-200 bg-red-50 text-red-700' },
    ALL: { badge: 'gray', number: 'text-gray-900', tile: 'border-gray-200 bg-white text-gray-800' },
  },
  tileActive: 'ring-2 ring-blue-500',
  // History: what happened to the stock.
  logType: {
    INITIAL: { badge: 'blue', sign: '', number: 'text-blue-700' },
    INCREASE: { badge: 'green', sign: '+', number: 'text-green-700' },
    DEDUCT: { badge: 'red', sign: '−', number: 'text-red-600' },
  },
  preview: {
    INCREASE: 'border-green-200 bg-green-50 text-green-800',
    DEDUCT: 'border-red-200 bg-red-50 text-red-700',
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
    ghost: 'ghost',
  },
};

export default theme;
