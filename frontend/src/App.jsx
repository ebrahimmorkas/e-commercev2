import { useState } from 'react';
import AnnouncementsPage from './admin/features/anoucements/pages/AnnouncementsPage';
import CategoriesPage from './admin/masters/category/pages/CategoriesPage';
import BrandsPage from './admin/masters/brand/pages/BrandsPage';
import ProductsPage from './admin/features/products/pages/ProductsPage';
import DiscountsPage from './admin/features/discounts/pages/DiscountsPage';
import OrdersPage from './admin/features/orders/pages/OrdersPage';
import AbandonedCartsPage from './admin/features/abandonedCart/pages/AbandonedCartsPage';
import BannersPage from './admin/features/banners/pages/BannersPage';
import FreeCashPage from './admin/features/freeCash/pages/FreeCashPage';
import LoginPage from './admin/features/login/pages/LoginPage';
import { useAuth } from './admin/features/login/hooks/useAuth';
import { useAssignedModules } from './admin/modules/hooks/useAssignedModules';
import Spinner from './components/common/Spinner';
import EmptyState from './components/common/EmptyState';
import Sidebar, { DEFAULT_NAV_ITEMS, filterNavItemsByAssignedModules } from './components/ui/Sidebar';

const PAGE_LABELS = DEFAULT_NAV_ITEMS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { assignedCodes } = useAssignedModules(isAuthenticated);
  const navItems = filterNavItemsByAssignedModules(DEFAULT_NAV_ITEMS, assignedCodes);
  const [activePage, setActivePage] = useState('announcements');

  // The hardcoded initial 'announcements' page may not be assigned to this
  // vendor - fall back to the first section that actually is, once
  // assignedCodes has loaded (navItems is unfiltered, so this is a no-op,
  // while it's still loading).
  const isActivePageAllowed = navItems.some((item) => item.key === activePage);
  const effectiveActivePage = isActivePageAllowed ? activePage : (navItems[0]?.key ?? activePage);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="App md:flex min-h-screen bg-gray-50">
      <Sidebar items={navItems} activeKey={effectiveActivePage} onNavigate={setActivePage} user={user} onLogout={logout} />

      <div className="flex-1 min-w-0">
        {effectiveActivePage === 'announcements' ? (
          <AnnouncementsPage />
        ) : effectiveActivePage === 'categories' ? (
          <CategoriesPage />
        ) : effectiveActivePage === 'brands' ? (
          <BrandsPage />
        ) : effectiveActivePage === 'products' ? (
          <ProductsPage />
        ) : effectiveActivePage === 'discounts' ? (
          <DiscountsPage />
        ) : effectiveActivePage === 'orders' ? (
          <OrdersPage />
        ) : effectiveActivePage === 'abandonedCarts' ? (
          <AbandonedCartsPage />
        ) : effectiveActivePage === 'banners' ? (
          <BannersPage />
        ) : effectiveActivePage === 'freeCash' ? (
          <FreeCashPage />
        ) : (
          <EmptyState
            title={`${PAGE_LABELS[effectiveActivePage] || 'This page'} is coming soon`}
            description="This section hasn't been built yet."
            className="max-w-6xl mx-auto p-6"
          />
        )}
      </div>
    </div>
  );
}

export default App;
