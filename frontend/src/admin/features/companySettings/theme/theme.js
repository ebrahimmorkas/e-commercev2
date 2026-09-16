/**
 * Central color theme for the Company Settings feature.
 *
 * Every component in this feature should pull its colors (and semantic
 * variant choices for shared components like Button/Switch) from here
 * instead of hardcoding Tailwind classes or variant names inline. To re-theme
 * this feature, edit this file only.
 */
const theme = {
  page: {
    background: 'bg-gray-50',
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
    info: {
      background: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
    },
  },
  switch: {
    color: 'blue',
  },
  button: {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
    ghost: 'ghost',
  },
};

export default theme;
