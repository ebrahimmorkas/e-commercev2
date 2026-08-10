/**
 * Central color theme.
 *
 * Every component should pull its colors from here instead of hardcoding
 * Tailwind color classes inline. To re-theme the app, edit this file only.
 */
import htmLogo from '../../../../assets/htm_logo.jpeg';

const theme = {
  logo: {
    src: htmLogo,
    alt: 'HTM',
    className: 'w-36 h-32 rounded-full object-cover ring-4 ring-white shadow-lg',
  },
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
  },
  alert: {
    error: {
      background: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
  },
  link: {
    default: 'text-blue-600 hover:text-blue-700',
  },
  checkbox: {
    default: 'border-gray-300 text-blue-600 focus:ring-blue-500',
  },
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer',
  },
};

export default theme;