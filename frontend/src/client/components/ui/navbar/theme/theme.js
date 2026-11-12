/**
 * Central color theme for the client Navbar (hover mega-menu).
 * Shares the gold/navy palette pulled from the HTM logo.
 */
const theme = {
  bar: {
    background: 'bg-white',
    border: 'border-slate-200',
    text: 'text-slate-700',
    hover: 'hover:text-brand-600',
    active: 'text-brand-600',
  },
  panel: {
    background: 'bg-white',
    border: 'border-brand-200',
    shadow: 'shadow-2xl',
    heading: 'text-slate-900',
    item: 'text-slate-600 hover:text-brand-700',
  },
  brandCard: {
    background: 'bg-brand-50',
    border: 'border-brand-100',
    name: 'text-slate-900',
    tag: 'text-brand-700',
  },
  drawer: {
    overlay: 'bg-slate-900/60',
    background: 'bg-white',
    border: 'border-slate-100',
    shadow: 'shadow-2xl',
    title: 'text-slate-900',
    close: 'text-slate-500 hover:text-brand-600',
    link: 'text-slate-900 hover:bg-brand-50 hover:text-brand-700',
    accordionHeader: 'text-slate-900 hover:bg-brand-50',
    chevron: 'text-slate-400',
    divider: 'border-slate-100',
  },
};

export default theme;
