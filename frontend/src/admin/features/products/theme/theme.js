/**
 * Central color theme for the Products feature. Mirrors
 * admin/masters/category/theme/theme.js's shape - Tailwind class strings for
 * raw layout/text/alert concerns, semantic variant-name strings for keys
 * that map straight onto a shared component's own variant/color prop.
 */
const theme = {
  page: {
    background: 'bg-gray-50',
  },
  card: {
    background: 'bg-white',
  },
  text: {
    heading: 'text-gray-900',
    subheading: 'text-gray-500',
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
    success: {
      background: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
  },
  badge: {
    active: 'green',
    inactive: 'gray',
    variant: 'blue',
    default: 'purple',
  },
  switch: {
    color: 'blue',
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
    ghost: 'ghost',
    outline: 'outline',
  },
};

export default theme;
