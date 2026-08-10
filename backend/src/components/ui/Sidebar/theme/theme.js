/**
 * Central color theme for the Sidebar component.
 *
 * The Sidebar pulls every color from here instead of hardcoding Tailwind
 * classes inline. To re-theme the Sidebar (e.g. swap the brand colors),
 * edit this file only.
 */
const theme = {
  sidebar: {
    background: 'bg-white',
    border: 'border-gray-200',
  },
  drawer: {
    background: 'bg-white',
    border: 'border-gray-100',
    overlay: 'bg-gray-900/40',
    shadow: 'shadow-2xl',
  },
  brand: {
    mark: 'bg-blue-600 text-white',
    text: 'text-gray-900',
    subtitle: 'text-gray-400',
  },
  link: {
    base: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
    active: 'bg-blue-50 text-blue-700',
    iconBase: 'text-gray-400 group-hover:text-gray-500',
    iconActive: 'text-blue-600',
    activeBar: 'bg-blue-600',
  },
  toggle: {
    base: 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  },
  footer: {
    border: 'border-gray-100',
    hover: 'hover:bg-gray-50',
    avatar: 'bg-blue-600 text-white',
    name: 'text-gray-900',
    role: 'text-gray-500',
    logout: 'text-gray-400 hover:text-red-600 hover:bg-red-50',
  },
};

export default theme;
