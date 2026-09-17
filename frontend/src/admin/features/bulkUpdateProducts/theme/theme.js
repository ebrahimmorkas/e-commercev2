/**
 * Central color theme for the Bulk Update Products feature. Every component
 * in this feature should pull its colors (and semantic variant choices for
 * shared components like Button) from here instead of hardcoding Tailwind
 * classes or variant names inline. To re-theme this feature, edit this file
 * only. Mirrors the Categories master's theme.js.
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
  button: {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
    ghost: 'ghost',
  },
};

export default theme;
