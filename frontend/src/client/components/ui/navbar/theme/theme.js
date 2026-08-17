/**
 * Central color theme for the client Navbar (hover mega-menu).
 * Shares the gold/navy palette pulled from the HTM logo.
 */
const theme = {
  bar: {
    background: 'bg-white',
    border: 'border-slate-200',
    text: 'text-slate-700',
    hover: 'hover:text-amber-600',
    active: 'text-amber-600',
  },
  panel: {
    background: 'bg-white',
    border: 'border-amber-200',
    shadow: 'shadow-2xl',
    heading: 'text-slate-900',
    item: 'text-slate-600 hover:text-amber-700',
  },
  brandCard: {
    background: 'bg-amber-50',
    border: 'border-amber-100',
    name: 'text-slate-900',
    tag: 'text-amber-700',
  },
  colorSwatch: {
    ring: 'ring-slate-200',
    label: 'text-slate-600',
  },
  drawer: {
    overlay: 'bg-slate-900/60',
    background: 'bg-white',
    border: 'border-slate-100',
    shadow: 'shadow-2xl',
    title: 'text-slate-900',
    close: 'text-slate-500 hover:text-amber-600',
    link: 'text-slate-900 hover:bg-amber-50 hover:text-amber-700',
    accordionHeader: 'text-slate-900 hover:bg-amber-50',
    chevron: 'text-slate-400',
    divider: 'border-slate-100',
  },
};

export default theme;
