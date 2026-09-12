import { useEffect, useRef, useState } from 'react';
import theme from './theme/theme';
import { ChevronDownIcon, MenuIcon, CloseIcon } from './icons';
import { COLORS, SUPPORT_LINKS } from './data';
import { useStorefrontCategories } from '../../../features/categories/hooks/useStorefrontCategories';
import { useStorefrontBrands } from '../../../features/brands/hooks/useStorefrontBrands';

const NAV_ITEMS = [
  { key: 'home', label: 'Home' },
  { key: 'category', label: 'Shop' },
  { key: 'brands', label: 'Brands' },
  { key: 'colors', label: 'Colors' },
  { key: 'support', label: 'Support' },
];

// One category row. If it has its own children, it gets a single toggle
// arrow rather than dumping them inline - clicking it reveals that node's
// children (each of which follows the same rule), so deep taxonomies stay
// collapsed by default instead of piling into one long indented column.
const CategoryItem = ({ node }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`inline-flex items-center justify-center p-0.5 rounded cursor-pointer ${theme.panel.item}`}
            aria-label={expanded ? `Hide ${node.categoryName} sub-categories` : `Show ${node.categoryName} sub-categories`}
            aria-expanded={expanded}
          >
            <ChevronDownIcon
              className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-180' : '-rotate-90'}`}
            />
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" aria-hidden="true" />
        )}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className={`text-sm transition-colors duration-150 ${theme.panel.item}`}
        >
          {node.categoryName}
        </a>
      </div>
      {hasChildren && expanded && (
        <ul className="mt-2 space-y-2 pl-3 border-l border-slate-100">
          {node.children.map((child) => (
            <CategoryItem key={child._id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

const CategorySubtree = ({ nodes }) => (
  <ul className="mt-3 space-y-2">
    {nodes.map((node) => (
      <CategoryItem key={node._id} node={node} />
    ))}
  </ul>
);

const CategoryPanelSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 animate-pulse" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="space-y-3">
        <div className="h-3 w-2/3 rounded bg-slate-200" />
        <div className="h-2.5 w-full rounded bg-slate-100" />
        <div className="h-2.5 w-5/6 rounded bg-slate-100" />
        <div className="h-2.5 w-1/2 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

// Top-level categories become the panel's columns, with each one's
// sub-categories nested underneath - built from the live Category tree
// (see features/categories) rather than any hardcoded taxonomy.
const CategoryPanel = ({ categoryTree = [], loading }) => {
  if (loading) return <CategoryPanelSkeleton />;

  if (categoryTree.length === 0) {
    return <p className={`text-sm ${theme.panel.item}`}>No categories available yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
      {categoryTree.map((category) => (
        <div key={category._id}>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={`text-xs font-bold tracking-wide uppercase transition-colors duration-150 hover:text-amber-600 ${theme.panel.heading}`}
          >
            {category.categoryName}
          </a>
          {category.children.length > 0 && <CategorySubtree nodes={category.children} />}
        </div>
      ))}
    </div>
  );
};

const BrandsPanelSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 animate-pulse" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-16 rounded-lg bg-slate-100" />
    ))}
  </div>
);

// Columns are built from the live Brand Master list (see features/brands)
// rather than a hardcoded partner roster.
const BrandsPanel = ({ brands = [], loading }) => {
  if (loading) return <BrandsPanelSkeleton />;

  if (brands.length === 0) {
    return <p className={`text-sm ${theme.panel.item}`}>No brands available yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {brands.map((brand) => (
        <div
          key={brand._id}
          className={`rounded-lg border px-4 py-4 text-center ${theme.brandCard.background} ${theme.brandCard.border}`}
        >
          <p className={`text-sm font-bold ${theme.brandCard.name}`}>{brand.brandName}</p>
        </div>
      ))}
    </div>
  );
};

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
  const { categoryTree, loading: categoriesLoading } = useStorefrontCategories();
  const categoryPanelProps = { categoryTree, loading: categoriesLoading };

  const { brands, loading: brandsLoading } = useStorefrontBrands();
  const brandPanelProps = { brands, loading: brandsLoading };

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

  const getPanelProps = (key) => {
    if (key === 'category') return categoryPanelProps;
    if (key === 'brands') return brandPanelProps;
    return {};
  };

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
            <Panel {...getPanelProps(openKey)} />
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
                      <Content {...getPanelProps(item.key)} />
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
