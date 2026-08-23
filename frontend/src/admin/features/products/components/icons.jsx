/**
 * Shared line-icon set for section headers across the product form. Kept
 * separate from the small per-file action icons (trash/plus/etc.) since
 * these are purely decorative markers for SectionCard, not interactive.
 */
const base = 'w-[18px] h-[18px]';

export const TagIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581a1.5 1.5 0 002.122 0l6.318-6.318a1.5 1.5 0 000-2.122l-9.581-9.581A2.25 2.25 0 0010.318 3H9.568z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75z" />
  </svg>
);

export const FolderIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75A2.25 2.25 0 016 4.5h3.879a1.5 1.5 0 011.06.44l1.622 1.62a1.5 1.5 0 001.06.44H18a2.25 2.25 0 012.25 2.25v8.25A2.25 2.25 0 0118 19.5H6a2.25 2.25 0 01-2.25-2.25V6.75z" />
  </svg>
);

export const DocumentIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const SearchIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

export const CoinsIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-3.038 0-5.5.784-5.5 1.75s2.462 1.75 5.5 1.75 5.5-.784 5.5-1.75-2.462-1.75-5.5-1.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 8.5v9c0 .966 2.462 1.75 5.5 1.75s5.5-.784 5.5-1.75v-9M6.5 12.25c0 .966 2.462 1.75 5.5 1.75s5.5-.784 5.5-1.75" />
  </svg>
);

export const SwatchIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-1.5m-10.5-12v10.5A1.5 1.5 0 006 19.5h1.879a1.5 1.5 0 001.06-.44l6.122-6.12a1.5 1.5 0 000-2.122l-3.879-3.879a1.5 1.5 0 00-1.06-.439H6A1.5 1.5 0 004.5 7.5z" />
    <circle cx="8.25" cy="8.25" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const RulerIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25l11.25 11.25a1.5 1.5 0 002.122 0l2.628-2.628a1.5 1.5 0 000-2.122L9.25 3.5a1.5 1.5 0 00-2.122 0L4.5 6.128a1.5 1.5 0 000 2.122z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 8l1.5-1.5M11 11l1.5-1.5M14 14l1.5-1.5M17 17l1.5-1.5" />
  </svg>
);

export const ImageIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 5.25h18a.75.75 0 01.75.75v12a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75v-12a.75.75 0 01.75-.75z" />
    <circle cx="8.25" cy="9" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

export const ShieldIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75l7.5 2.917v5.166c0 4.542-3.13 8.017-7.5 9.417-4.37-1.4-7.5-4.875-7.5-9.417V6.667L12 3.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.25 12.25l1.75 1.75 3.75-3.75" />
  </svg>
);

export const TruckIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h9v10.5h-9A1.5 1.5 0 012.25 15V7.5A1.5 1.5 0 013.75 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 9.75h3.421a1.5 1.5 0 011.28.72l1.879 3.09v2.94h-2.25m-4.33 0h-3" />
    <circle cx="7" cy="17.5" r="1.5" />
    <circle cx="17" cy="17.5" r="1.5" />
  </svg>
);

export const LayersIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8.25 4.5L12 12 3.75 7.5 12 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12l8.25 4.5 8.25-4.5M3.75 16.5l8.25 4.5 8.25-4.5" />
  </svg>
);

export const MapPinIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 6-7.5 10.5-7.5 10.5S4.5 16.5 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

export const BoxIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-4.5-9 4.5m18 0l-9 4.5m9-4.5v9l-9 4.5m0-9L3 7.5m9 4.5v9M3 7.5v9l9 4.5" />
  </svg>
);

export const SparkleCheckIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l1.5 1.5 3.75-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const SlidersIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h9m0 0a2.25 2.25 0 104.5 0 2.25 2.25 0 00-4.5 0zm0 10.5h4.5m-9 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm0 0H4.5m6-5.25h9m-13.5 0a2.25 2.25 0 10-4.5 0 2.25 2.25 0 004.5 0z" />
  </svg>
);
