/**
 * Central color theme for the admin Reviews feature.
 * Re-theme this feature by editing this file only.
 */
const theme = {
  text: {
    heading: 'text-gray-900',
    subheading: 'text-gray-500',
    body: 'text-gray-700',
    muted: 'text-gray-400',
    warning: 'text-amber-600',
  },
  star: {
    filled: 'text-amber-400',
    empty: 'text-gray-200',
  },
  badge: {
    moderation: {
      APPROVED: 'green',
      PENDING: 'yellow',
      REJECTED: 'red',
    },
    deleted: 'gray',
    pendingChanges: 'purple',
    edited: 'blue',
  },
  panel: {
    border: 'border-gray-200',
    background: 'bg-gray-50',
    live: 'border-green-200 bg-green-50/60',
    pending: 'border-amber-200 bg-amber-50/60',
  },
  alert: {
    error: {
      background: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
    info: {
      background: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
    },
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    outline: 'outline',
    ghost: 'ghost',
    danger: 'danger',
    success: 'success',
    warning: 'warning',
  },
  input:
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50',
};

export default theme;
