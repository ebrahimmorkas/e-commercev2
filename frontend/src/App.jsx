import { useState } from 'react';
import AnnouncementsPage from './admin/features/anoucements/pages/AnnouncementsPage';
import CategoriesPage from './admin/masters/category/pages/CategoriesPage';
import ProductsPage from './admin/features/products/pages/ProductsPage';
import DiscountsPage from './admin/features/discounts/pages/DiscountsPage';
import LoginPage from './admin/features/login/pages/LoginPage';
import { useAuth } from './admin/features/login/hooks/useAuth';
import Spinner from './components/common/Spinner';
import EmptyState from './components/common/EmptyState';
import Sidebar, { DEFAULT_NAV_ITEMS } from './components/ui/Sidebar';

const PAGE_LABELS = DEFAULT_NAV_ITEMS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [activePage, setActivePage] = useState('announcements');

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
      <Sidebar activeKey={activePage} onNavigate={setActivePage} user={user} onLogout={logout} />

      <div className="flex-1 min-w-0">
        {activePage === 'announcements' ? (
          <AnnouncementsPage />
        ) : activePage === 'categories' ? (
          <CategoriesPage />
        ) : activePage === 'products' ? (
          <ProductsPage />
        ) : activePage === 'discounts' ? (
          <DiscountsPage />
        ) : (
          <EmptyState
            title={`${PAGE_LABELS[activePage] || 'This page'} is coming soon`}
            description="This section hasn't been built yet."
            className="max-w-6xl mx-auto p-6"
          />
        )}
      </div>
    </div>
  );
}

export default App;
