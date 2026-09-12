/**
 * Central style theme for the client Home page and the shared product card /
 * add-to-cart control it renders.
 *
 * Holds every Tailwind className string used by those components - colors,
 * layout, shadows, hover/active states and 3D-effect classes alike - so the
 * whole look (including the 3D/tilt/shine effects) can be re-themed here
 * without touching component markup. The only exceptions are the raw
 * `@keyframes` bodies and the `.shine-sweep::after` pseudo-element rule
 * those effect classes rely on, which live in `src/index.css` because
 * Tailwind class strings can't express a keyframe or a `::after` selector.
 */
const theme = {
  page: {
    background: 'bg-white',
  },
  hero: {
    section: 'relative overflow-hidden px-4 sm:px-6 py-20',
    container: 'relative max-w-7xl mx-auto flex flex-col items-center text-center [perspective:1000px]',
    background: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    eyebrow: 'text-amber-400',
    eyebrowLayout: 'text-sm font-semibold tracking-wide uppercase',
    heading: 'text-white',
    headingLayout: 'mt-3 text-3xl sm:text-5xl font-bold drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
    subheading: 'text-slate-300',
    subheadingLayout: 'mt-4 max-w-xl text-base',
    cta: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
    ctaLayout:
      'group relative overflow-hidden mt-8 px-6 py-3 rounded-full text-sm font-semibold shadow-lg shadow-amber-900/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-900/50 active:translate-y-0 cursor-pointer',
    ctaSecondaryLayout: 'px-4 py-2 rounded-full text-sm font-semibold cursor-pointer',
    ctaShine: 'shine-sweep absolute inset-0',
    ctaLabel: 'relative',
    ctaWrapper: 'mt-6',
  },
  floatingGems: {
    wrapper: 'pointer-events-none absolute inset-0 overflow-hidden',
    items: [
      'absolute top-10 left-[8%] w-10 h-10 text-amber-400/30 animate-float drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]',
      'absolute bottom-14 left-[18%] w-6 h-6 text-amber-300/20 animate-float-slow drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]',
      'absolute top-16 right-[12%] w-14 h-14 text-amber-400/20 animate-float-slow drop-shadow-[0_0_14px_rgba(251,191,36,0.3)]',
      'absolute bottom-10 right-[22%] w-8 h-8 text-amber-300/25 animate-float drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]',
    ],
  },
  partnerBadge: {
    layout:
      'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wide uppercase shadow-lg shadow-black/20 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5',
    background: 'bg-white/5',
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    icon: 'text-amber-400',
    iconLayout: 'w-4 h-4 shrink-0 animate-spin-slow',
  },
  section: {
    wrapper: 'max-w-7xl mx-auto px-4 sm:px-6 py-14',
    headerWrapper: 'text-center mb-10',
    heading: 'text-slate-900',
    headingLayout: 'text-2xl font-bold',
    subheading: 'text-slate-500',
    subheadingLayout: 'mt-2 text-sm',
    loadingWrapper: 'flex justify-center py-16',
    grid: 'grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6',
  },
  card: {
    layout: 'group rounded-xl border overflow-hidden transition-[box-shadow,transform] duration-200 ease-out will-change-transform',
    clickable: 'cursor-pointer',
    background: 'bg-white',
    border: 'border-slate-200',
    shadow: 'shadow-sm hover:shadow-2xl hover:shadow-amber-900/15',
    body: 'p-4',

    imageWrapperLayout: 'relative aspect-square flex items-center justify-center overflow-hidden shine-sweep',
    imageBackground: 'bg-gradient-to-br from-amber-100 to-amber-200',
    imageLayout: 'w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-110',
    imageTextLayout: 'text-xs font-bold tracking-widest uppercase',
    imageText: 'text-amber-700/40',

    categoryLayout: 'text-[11px] font-semibold tracking-wide uppercase',
    category: 'text-amber-700',
    nameLayout: 'mt-0.5 text-sm font-semibold',
    name: 'text-slate-900',
    priceLayout: 'mt-1 text-base font-bold',
    price: 'text-amber-700',
    unit: 'text-xs font-normal text-slate-400',
    actionsWrapper: 'mt-3',

    bulkWrapperLayout: 'mt-2 rounded-lg px-2.5 py-1.5',
    bulkBackground: 'bg-amber-50 border border-amber-200',
    bulkLabelLayout: 'text-[10px] font-bold tracking-wide uppercase',
    bulkLabel: 'text-amber-600/80',
    bulkTextLayout: 'text-xs font-medium',
    bulkText: 'text-slate-700',

    button: 'bg-slate-900 hover:bg-amber-600 text-white',
    buttonLayout:
      'group relative overflow-hidden w-full rounded-lg text-sm font-medium cursor-pointer shadow-md shadow-slate-900/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm',
    buttonHeight: {
      md: 'py-2',
      lg: 'py-2.5 px-8',
    },
    buttonShine: 'shine-sweep absolute inset-0',
    outOfStockLayout: 'w-full rounded-lg text-sm font-medium cursor-not-allowed',
    outOfStock: 'bg-slate-200 text-slate-400',

    stepperLayout: 'flex items-center justify-between rounded-lg',
    stepperButtonLayout: 'px-4 py-2 text-base font-semibold cursor-pointer hover:bg-black/10',
    stepperButtonLeft: 'rounded-l-lg',
    stepperButtonRight: 'rounded-r-lg disabled:opacity-40 disabled:cursor-not-allowed',
    stepperCountLayout: 'text-sm font-semibold min-w-6 text-center',
  },
};

export default theme;
