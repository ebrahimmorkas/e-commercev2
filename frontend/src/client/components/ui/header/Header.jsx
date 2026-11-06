import { useEffect, useId, useRef, useState } from 'react';
import { useSearchSuggestions } from '../../../features/products/hooks/useSearchSuggestions';
import theme from './theme/theme';
import { SearchIcon, CartIcon, UserIcon, LogoutIcon, ChevronDownIcon, OrdersIcon, LocationIcon } from './icons';
import { useStorefrontCompanySettings } from '../../../features/companySettings/hooks/useStorefrontCompanySettings';
import { useCurrency } from '../../../currency/useCurrency';

// Suggestion prices arrive in the store currency; formatMoney converts and labels them.
const formatSuggestionPrice = (product, formatMoney) => {
  if (product.priceRange) return `${formatMoney(product.priceRange.min)} - ${formatMoney(product.priceRange.max)}`;
  if (typeof product.price === 'number') return formatMoney(product.price);
  return null;
};

const getInitials = (label) => {
  if (!label) return 'U';
  const parts = label.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
};

const SearchBar = ({ onSearch, onProductSelect, onPanelOpenChange, className = '' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapperRef = useRef(null);
  const { suggestions, loading, query: trimmed } = useSearchSuggestions(query);
  const { formatMoney } = useCurrency();

  // Close when clicking anywhere outside the search box.
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const showPanel = open && trimmed.length >= 2;
  const listId = useId();

  // Tell the page while the suggestion list is open, so the nav mega-menus
  // stay shut instead of opening over it.
  useEffect(() => {
    onPanelOpenChange?.(showPanel);
    return () => onPanelOpenChange?.(false);
  }, [showPanel, onPanelOpenChange]);

  const runSearch = () => {
    setOpen(false);
    onSearch?.(trimmed);
  };

  const pickProduct = (product) => {
    setOpen(false);
    onProductSelect?.(product.id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (highlight >= 0 && suggestions[highlight]) pickProduct(suggestions[highlight]);
    else runSearch();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    }
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <form
        onSubmit={handleSubmit}
        className={`flex items-center w-full rounded-full border transition-colors duration-150 ${theme.search.background} ${theme.search.border}`}
      >
        <SearchIcon className={`w-4.5 h-4.5 ml-3.5 shrink-0 ${theme.search.icon}`} />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search for products..."
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
          autoComplete="off"
          className={`flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm outline-none ${theme.search.text}`}
        />
        <button type="submit" className={`px-4 py-2 text-sm font-medium shrink-0 cursor-pointer ${theme.search.button}`}>
          Search
        </button>
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg"
        >
          {loading && <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>}
          {!loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">No products match &ldquo;{trimmed}&rdquo;</p>
          )}
          {!loading &&
            suggestions.map((product, index) => (
              <button
                key={product.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pickProduct(product)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left cursor-pointer ${index === highlight ? 'bg-amber-50' : ''}`}
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {product.image && <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{product.name}</span>
                {formatSuggestionPrice(product, formatMoney) && (
                  <span className="shrink-0 text-sm text-slate-500">{formatSuggestionPrice(product, formatMoney)}</span>
                )}
              </button>
            ))}
          {!loading && suggestions.length > 0 && (
            <button
              type="button"
              onClick={runSearch}
              className="w-full border-t border-amber-100 px-4 py-2.5 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 cursor-pointer"
            >
              See all results for &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
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

const ProfileMenu = ({ user, onLogout, onOrdersClick, onAddressesClick }) => {
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
              onOrdersClick?.();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.profile.trigger}`}
            role="menuitem"
          >
            <OrdersIcon className="w-4.5 h-4.5" />
            My Orders
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onAddressesClick?.();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.profile.trigger}`}
            role="menuitem"
          >
            <LocationIcon className="w-4.5 h-4.5" />
            Addresses
          </button>
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
 * @param {boolean} [props.authLoading] - True during the initial silent-refresh check on mount -
 *   renders a neutral placeholder instead of the Login button so a logged-in visitor never sees
 *   a flash of "Login" before their session is confirmed restored.
 * @param {Object} [props.user] - Current user ({ name, username, email }), shown when authenticated.
 * @param {number} [props.cartCount] - Number of items in the cart, shown as a badge.
 * @param {Function} [props.onSearch] - Called with the trimmed query string on search submit.
 * @param {Function} [props.onProductSelect] - Called with a product id when a typeahead suggestion is chosen.
 * @param {Function} [props.onSearchPanelChange] - Called with true/false as the suggestion list opens/closes (should be a stable function).
 * @param {Function} [props.onCartClick] - Called when the cart icon is clicked.
 * @param {Function} [props.onLoginClick] - Called when the login button is clicked (shown when logged out).
 * @param {Function} [props.onLogout] - Called when logout is selected from the profile menu.
 * @param {Function} [props.onOrdersClick] - Called when "My Orders" is selected from the profile menu.
 * @param {Function} [props.onAddressesClick] - Called when "Addresses" is selected from the profile menu.
 * @param {string} [props.homeHref] - href for the logo link.
 */
const Header = ({
  isAuthenticated = false,
  authLoading = false,
  user,
  cartCount = 0,
  onSearch,
  onProductSelect,
  onSearchPanelChange,
  onCartClick,
  onLoginClick,
  onLogout,
  onOrdersClick,
  onAddressesClick,
  homeHref = '/',
}) => {
  const { companySettings } = useStorefrontCompanySettings();
  const logoSrc = companySettings?.companyLogo?.url;
  const logoAlt = companySettings?.companyName ;

  return (
    <header className={`sticky top-0 z-40 border-b ${theme.header.background} ${theme.header.border} ${theme.header.shadow}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-4">
          <a href={homeHref} className="shrink-0 flex items-center">
            <img src={logoSrc} alt={logoAlt} className={theme.logo.className} />
          </a>

          <SearchBar onSearch={onSearch} onProductSelect={onProductSelect} onPanelOpenChange={onSearchPanelChange} className="hidden sm:block flex-1" />

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <CartButton count={cartCount} onClick={onCartClick} />
            {authLoading ? (
              <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" aria-hidden="true" />
            ) : isAuthenticated ? (
              <ProfileMenu user={user} onLogout={onLogout} onOrdersClick={onOrdersClick} onAddressesClick={onAddressesClick} />
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

        <SearchBar onSearch={onSearch} onProductSelect={onProductSelect} onPanelOpenChange={onSearchPanelChange} className="block sm:hidden mt-3" />
      </div>
    </header>
  );
};

export default Header;
