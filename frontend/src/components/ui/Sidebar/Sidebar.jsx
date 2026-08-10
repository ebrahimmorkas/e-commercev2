import { useEffect, useState } from 'react';
import theme from './theme/theme';
import { DEFAULT_NAV_ITEMS } from './navItems';
import { MenuIcon, CloseIcon, LogoutIcon } from './icons';

const getInitials = (label) => {
  if (!label) return 'U';
  const parts = label.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

const BrandMark = ({ brand, subtitle }) => (
  <div className="h-16 flex items-center gap-2.5 px-4 shrink-0">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${theme.brand.mark}`}>
      {brand?.[0]?.toUpperCase() || 'A'}
    </div>
    <div className="min-w-0">
      <p className={`text-base font-bold leading-tight truncate ${theme.brand.text}`}>{brand}</p>
      {subtitle && <p className={`text-xs leading-tight truncate ${theme.brand.subtitle}`}>{subtitle}</p>}
    </div>
  </div>
);

const NavLinks = ({ items, activeKey, onSelect }) => (
  <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
    {items.map((item) => {
      const isActive = item.key === activeKey;
      const Icon = item.icon;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className={`group relative w-full flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
            isActive ? theme.link.active : theme.link.base
          }`}
          aria-current={isActive ? 'page' : undefined}
        >
          {isActive && <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${theme.link.activeBar}`} />}
          {Icon && <Icon className={`w-5 h-5 shrink-0 ${isActive ? theme.link.iconActive : theme.link.iconBase}`} />}
          <span className="truncate">{item.label}</span>
        </button>
      );
    })}
  </nav>
);

const UserFooter = ({ user, onLogout }) => {
  if (!user) return null;
  const displayName = user.name || user.username || user.email || 'Account';
  const role = capitalize(user.role);

  return (
    <div className={`shrink-0 border-t p-3 ${theme.footer.border}`}>
      <div className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-150 ${theme.footer.hover}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${theme.footer.avatar}`}>
          {getInitials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${theme.footer.name}`}>{displayName}</p>
          {role && <p className={`text-xs truncate ${theme.footer.role}`}>{role}</p>}
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer ${theme.footer.logout}`}
            aria-label="Logout"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Left-hand navigation for the admin UI.
 *
 * Renders as a fixed, always-visible column on desktop (md+) and collapses
 * into a hamburger-triggered off-canvas drawer with a backdrop on mobile
 * (the hamburger trigger itself only exists below the md breakpoint).
 *
 * @param {Object} props
 * @param {string} [props.brand] - Text shown as the brand/logo.
 * @param {string} [props.subtitle] - Small text shown under the brand name.
 * @param {Array<{key: string, label: string, icon?: Function}>} [props.items] - Nav links, defaults to DEFAULT_NAV_ITEMS.
 * @param {string} props.activeKey - Key of the currently active item.
 * @param {Function} props.onNavigate - Called with an item's key when it is selected.
 * @param {Object} [props.user] - Current user ({ name, username, email, role }); footer is omitted if absent.
 * @param {Function} [props.onLogout] - Called when the footer's logout button is clicked.
 */
const Sidebar = ({
  brand = 'Admin Panel',
  subtitle = 'Management Console',
  items = DEFAULT_NAV_ITEMS,
  activeKey,
  onNavigate,
  user,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close the mobile drawer on Escape and lock page scroll while it's open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Collapsing back to desktop width while the drawer is open would otherwise
  // leave the scroll lock stuck on and the drawer mounted-but-hidden.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleChange = (e) => {
      if (e.matches) setIsOpen(false);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const handleSelect = (key) => {
    setIsOpen(false);
    onNavigate?.(key);
  };

  return (
    <>
      {/* Mobile top bar - the hamburger trigger only ever renders here, never on desktop */}
      <div
        className={`md:hidden flex items-center justify-between px-4 h-14 ${theme.sidebar.background} border-b ${theme.sidebar.border}`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${theme.brand.mark}`}>
            {brand?.[0]?.toUpperCase() || 'A'}
          </div>
          <span className={`text-base font-bold ${theme.brand.text}`}>{brand}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center justify-center p-2 rounded-md cursor-pointer ${theme.toggle.base}`}
          aria-label="Open navigation menu"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:w-64 md:shrink-0 md:h-screen md:sticky md:top-0 ${theme.sidebar.background} border-r ${theme.sidebar.border}`}
      >
        <BrandMark brand={brand} subtitle={subtitle} />
        <NavLinks items={items} activeKey={activeKey} onSelect={handleSelect} />
        <UserFooter user={user} onLogout={onLogout} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div
          className={`absolute inset-0 ${theme.drawer.overlay}`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 flex flex-col w-72 max-w-[80%] h-full ${theme.drawer.background} ${theme.drawer.shadow} transform transition-transform duration-200 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`h-14 flex items-center justify-between px-4 border-b ${theme.drawer.border} shrink-0`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${theme.brand.mark}`}>
                {brand?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className={`text-base font-bold ${theme.brand.text}`}>{brand}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`inline-flex items-center justify-center p-2 rounded-md cursor-pointer ${theme.toggle.base}`}
              aria-label="Close navigation menu"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
          <NavLinks items={items} activeKey={activeKey} onSelect={handleSelect} />
          <UserFooter user={user} onLogout={onLogout} />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
