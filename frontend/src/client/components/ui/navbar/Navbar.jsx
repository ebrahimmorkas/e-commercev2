import { useEffect, useRef, useState } from 'react';
import theme from './theme/theme';
import { ChevronDownIcon, MenuIcon, CloseIcon } from './icons';
import { CATEGORY_GROUPS, BRANDS, COLORS, SUPPORT_LINKS } from './data';

const NAV_ITEMS = [
  { key: 'home', label: 'Home' },
  { key: 'category', label: 'Shop' },
  { key: 'brands', label: 'Brands' },
  { key: 'colors', label: 'Colors' },
  { key: 'support', label: 'Support' },
];

const CategoryPanel = () => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
    {CATEGORY_GROUPS.map((group) => (
      <div key={group.title}>
        <h3 className={`text-xs font-bold tracking-wide uppercase ${theme.panel.heading}`}>{group.title}</h3>
        <ul className="mt-3 space-y-2">
          {group.items.map((item) => (
            <li key={item}>
              <a href="#" className={`text-sm transition-colors duration-150 ${theme.panel.item}`}>
                {item}
              </a>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

const BrandsPanel = () => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
    {BRANDS.map((brand) => (
      <div
        key={brand.name}
        className={`rounded-lg border px-4 py-4 text-center ${theme.brandCard.background} ${theme.brandCard.border}`}
      >
        <p className={`text-sm font-bold ${theme.brandCard.name}`}>{brand.name}</p>
        <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${theme.brandCard.tag}`}>{brand.tag}</p>
      </div>
    ))}
  </div>
);

const ColorsPanel = () => (
  <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-6">
    {COLORS.map((color) => (
      <a key={color.name} href="#" className="flex flex-col items-center gap-2 group">
        <span
          className={`w-10 h-10 rounded-full ring-2 ring-offset-2 transition-shadow duration-150 ${theme.colorSwatch.ring} group-hover:ring-amber-400`}
          style={{ background: color.swatch }}
        />
        <span className={`text-xs text-center ${theme.colorSwatch.label}`}>{color.name}</span>
      </a>
    ))}
  </div>
);

const SupportPanel = () => (
  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
    {SUPPORT_LINKS.map((link) => (
      <li key={link}>
        <a href="#" className={`text-sm transition-colors duration-150 ${theme.panel.item}`}>
          {link}
        </a>
      </li>
    ))}
  </ul>
);

const PANELS = {
  category: CategoryPanel,
  brands: BrandsPanel,
  colors: ColorsPanel,
  support: SupportPanel,
};

const CLOSE_DELAY_MS = 150;

/**
 * Secondary navigation bar rendered below the Header.
 *
 * Desktop (sm+): ASUS-style hover mega-menus for everything except "Home".
 * Mobile: a hamburger trigger opens an off-canvas drawer with the same
 * items as a tap-to-expand accordion.
 */
const Navbar = () => {
  const [openKey, setOpenKey] = useState(null);
  const closeTimer = useRef(null);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mobileExpandedKey, setMobileExpandedKey] = useState(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS);
  };

  const openNow = (key) => {
    cancelClose();
    setOpenKey(key);
  };

  useEffect(() => () => cancelClose(), []);

  // Close the mobile drawer on Escape and lock page scroll while it's open.
  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  // Collapsing back to desktop width while the drawer is open would otherwise
  // leave the scroll lock stuck on and the drawer mounted-but-hidden.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    const handleChange = (e) => {
      if (e.matches) setIsMobileOpen(false);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const closeMobile = () => {
    setIsMobileOpen(false);
    setMobileExpandedKey(null);
  };

  const Panel = openKey ? PANELS[openKey] : null;

  return (
    <nav className={`relative border-b ${theme.bar.background} ${theme.bar.border}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Mobile trigger */}
        <div className="flex sm:hidden items-center justify-between h-11">
          <span className={`text-sm font-semibold tracking-wide uppercase ${theme.bar.active}`}>Menu</span>
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer ${theme.bar.text} ${theme.bar.hover}`}
            aria-label="Open menu"
            aria-haspopup="true"
            aria-expanded={isMobileOpen}
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop bar */}
        <ul className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = openKey === item.key;
            const hasPanel = Boolean(PANELS[item.key]);
            return (
              <li key={item.key} onMouseEnter={() => (hasPanel ? openNow(item.key) : scheduleClose())}>
                <a
                  href="/"
                  onClick={(e) => !hasPanel || e.preventDefault()}
                  className={`flex items-center gap-1 h-11 px-4 text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.bar.text} ${theme.bar.hover} ${
                    isActive ? theme.bar.active : ''
                  }`}
                  aria-haspopup={hasPanel ? 'true' : undefined}
                  aria-expanded={hasPanel ? isActive : undefined}
                >
                  {item.label}
                  {hasPanel && (
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-150 ${isActive ? 'rotate-180' : ''}`} />
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop hover mega-panel */}
      {Panel && (
        <div
          className={`hidden sm:block absolute left-0 right-0 top-full z-40 border-t ${theme.panel.background} ${theme.panel.border} ${theme.panel.shadow}`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <Panel />
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      <div
        className={`sm:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div className={`absolute inset-0 ${theme.drawer.overlay}`} onClick={closeMobile} aria-hidden="true" />
        <aside
          className={`absolute inset-y-0 left-0 flex flex-col w-80 max-w-[85%] h-full overflow-y-auto transform transition-transform duration-200 ${theme.drawer.background} ${theme.drawer.shadow} ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`h-14 flex items-center justify-between px-4 border-b shrink-0 ${theme.drawer.border}`}>
            <span className={`text-sm font-bold tracking-wide uppercase ${theme.drawer.title}`}>Menu</span>
            <button
              type="button"
              onClick={closeMobile}
              className={`inline-flex items-center justify-center p-2 rounded-md cursor-pointer ${theme.drawer.close}`}
              aria-label="Close menu"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3">
            <a
              href="/"
              onClick={closeMobile}
              className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${theme.drawer.link}`}
            >
              Home
            </a>

            {NAV_ITEMS.filter((item) => PANELS[item.key]).map((item) => {
              const isExpanded = mobileExpandedKey === item.key;
              const Content = PANELS[item.key];
              return (
                <div key={item.key} className={`border-t ${theme.drawer.divider}`}>
                  <button
                    type="button"
                    onClick={() => setMobileExpandedKey(isExpanded ? null : item.key)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.drawer.accordionHeader}`}
                    aria-expanded={isExpanded}
                  >
                    {item.label}
                    <ChevronDownIcon
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${theme.drawer.chevron} ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-4">
                      <Content />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </nav>
  );
};

export default Navbar;
