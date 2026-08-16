import { useEffect, useRef, useState } from 'react';
import theme from './theme/theme';
import { SearchIcon, CartIcon, UserIcon, LogoutIcon, ChevronDownIcon } from './icons';

const getInitials = (label) => {
  if (!label) return 'U';
  const parts = label.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
};

const SearchBar = ({ onSearch, className = '' }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(query.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`items-center w-full rounded-full border transition-colors duration-150 ${theme.search.background} ${theme.search.border} ${className}`}
    >
      <SearchIcon className={`w-4.5 h-4.5 ml-3.5 shrink-0 ${theme.search.icon}`} />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for products..."
        className={`flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm outline-none ${theme.search.text}`}
      />
      <button type="submit" className={`px-4 py-2 text-sm font-medium shrink-0 cursor-pointer ${theme.search.button}`}>
        Search
      </button>
    </form>
  );
};

const CartButton = ({ count = 0, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative p-2 rounded-full transition-colors duration-150 cursor-pointer ${theme.cart.icon}`}
    aria-label="Cart"
  >
    <CartIcon className="w-6 h-6" />
    {count > 0 && (
      <span
        className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-semibold ${theme.cart.badge}`}
      >
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
);

const ProfileMenu = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayName = user?.name || user?.username || user?.email || 'Account';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 p-1 pr-2 rounded-full transition-colors duration-150 cursor-pointer ${theme.profile.trigger}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${theme.profile.avatar}`}>
          {getInitials(displayName)}
        </span>
        <ChevronDownIcon className={`w-4 h-4 hidden sm:block transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-56 rounded-xl border overflow-hidden z-50 ${theme.profile.menu.background} ${theme.profile.menu.border} ${theme.profile.menu.shadow}`}
          role="menu"
        >
          <div className={`px-4 py-3 border-b ${theme.profile.menu.divider}`}>
            <p className={`text-sm font-semibold truncate ${theme.profile.menu.name}`}>{displayName}</p>
            {user?.email && <p className={`text-xs truncate ${theme.profile.menu.email}`}>{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout?.();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.profile.menu.logout}`}
            role="menuitem"
          >
            <LogoutIcon className="w-4.5 h-4.5" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Top header for the client-facing storefront.
 *
 * @param {Object} props
 * @param {boolean} [props.isAuthenticated] - Whether a user is currently logged in.
 * @param {Object} [props.user] - Current user ({ name, username, email }), shown when authenticated.
 * @param {number} [props.cartCount] - Number of items in the cart, shown as a badge.
 * @param {Function} [props.onSearch] - Called with the trimmed query string on search submit.
 * @param {Function} [props.onCartClick] - Called when the cart icon is clicked.
 * @param {Function} [props.onLoginClick] - Called when the login button is clicked (shown when logged out).
 * @param {Function} [props.onLogout] - Called when logout is selected from the profile menu.
 * @param {string} [props.homeHref] - href for the logo link.
 */
const Header = ({
  isAuthenticated = false,
  user,
  cartCount = 0,
  onSearch,
  onCartClick,
  onLoginClick,
  onLogout,
  homeHref = '/',
}) => {
  return (
    <header className={`sticky top-0 z-40 border-b ${theme.header.background} ${theme.header.border} ${theme.header.shadow}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-4">
          <a href={homeHref} className="shrink-0 flex items-center">
            <img src={theme.logo.src} alt={theme.logo.alt} className={theme.logo.className} />
          </a>

          <SearchBar onSearch={onSearch} className="hidden sm:flex flex-1" />

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <CartButton count={cartCount} onClick={onCartClick} />
            {isAuthenticated ? (
              <ProfileMenu user={user} onLogout={onLogout} />
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.login.button}`}
              >
                <UserIcon className="w-4 h-4" />
                Login
              </button>
            )}
          </div>
        </div>

        <SearchBar onSearch={onSearch} className="flex sm:hidden mt-3" />
      </div>
    </header>
  );
};

export default Header;
