/**
 * Central color theme for the Free Cash Usage feature. Every component in
 * this feature pulls its colors (and variant choices for shared components)
 * from here instead of hardcoding them inline.
 */
const theme = {
  text: {
    heading: 'text-gray-900',
    body: 'text-gray-600',
    muted: 'text-gray-400',
    error: 'text-red-600',
    active: 'text-green-700',
  },
  alert: {
    error: {
      background: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
  },
  tile: {
    neutral: 'border-gray-200 bg-white text-gray-800',
    active: 'border-green-200 bg-green-50 text-green-800',
  },
  // History row: Badge variant, and the sign / color of its amount.
  event: {
    ASSIGNED: { badge: 'blue', sign: '+', number: 'text-blue-700' },
    USED: { badge: 'purple', sign: '−', number: 'text-purple-700' },
    REFUNDED: { badge: 'green', sign: '+', number: 'text-green-700' },
    REVOKED: { badge: 'red', sign: '−', number: 'text-red-600' },
    RESTORED: { badge: 'green', sign: '+', number: 'text-green-700' },
    EXPIRED: { badge: 'yellow', sign: '−', number: 'text-amber-600' },
  },
  grantState: {
    ACTIVE: 'green',
    NOT_STARTED: 'blue',
    USED_UP: 'gray',
    REVOKED: 'red',
    EXPIRED: 'yellow',
    CAMPAIGN_INACTIVE: 'gray',
    CAMPAIGN_DELETED: 'gray',
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    ghost: 'ghost',
  },
};

export default theme;
