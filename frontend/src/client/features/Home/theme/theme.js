/**
 * Central color theme for the client Home page.
 *
 * Shares the gold/navy palette pulled from the HTM logo. To re-theme the
 * page, edit this file only.
 */
const theme = {
  page: {
    background: 'bg-white',
  },
  hero: {
    background: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    eyebrow: 'text-amber-400',
    heading: 'text-white',
    subheading: 'text-slate-300',
    cta: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
  },
  partnerBadge: {
    background: 'bg-white/5',
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    icon: 'text-amber-400',
  },
  section: {
    heading: 'text-slate-900',
    subheading: 'text-slate-500',
  },
  card: {
    background: 'bg-white',
    border: 'border-slate-200',
    shadow: 'hover:shadow-lg',
    imageBackground: 'bg-gradient-to-br from-amber-100 to-amber-200',
    imageText: 'text-amber-700/40',
    category: 'text-amber-700',
    name: 'text-slate-900',
    price: 'text-amber-700',
    button: 'bg-slate-900 hover:bg-amber-600 text-white',
  },
};

export default theme;
