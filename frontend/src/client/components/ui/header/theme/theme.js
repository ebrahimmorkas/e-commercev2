/**
 * Central color theme for the client Header component.
 *
 * Colors are pulled from the HTM logo (gold/amber lettering, navy "T", white
 * background). To re-theme the Header, edit this file only.
 */
import htmLogo from '../../../../../assets/htm_logo.jpeg';

const theme = {
  logo: {
    src: htmLogo,
    alt: 'HTM',
    className: 'h-16 sm:h-20 w-auto object-contain',
  },
  header: {
    background: 'bg-white',
    border: 'border-brand-200',
    shadow: 'shadow-sm',
  },
  search: {
    background: 'bg-brand-50',
    border: 'border-brand-200 focus-within:border-brand-500',
    text: 'text-slate-900 placeholder:text-slate-400',
    icon: 'text-brand-600',
    button: 'text-brand-700 hover:text-brand-800',
  },
  cart: {
    icon: 'text-slate-700 hover:text-brand-600',
    badge: 'bg-brand-600 text-white',
  },
  profile: {
    trigger: 'text-slate-700 hover:text-brand-600',
    avatar: 'bg-slate-900 text-brand-400',
    menu: {
      background: 'bg-white',
      border: 'border-brand-100',
      shadow: 'shadow-lg',
      name: 'text-slate-900',
      email: 'text-slate-500',
      logout: 'text-red-600 hover:bg-red-50',
      divider: 'border-brand-100',
    },
  },
  login: {
    button: 'bg-slate-900 hover:bg-brand-600 text-white',
  },
};

export default theme;
