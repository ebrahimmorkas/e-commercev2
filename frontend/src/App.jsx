import { useEffect, useState } from 'react';
import { useSessionStorageState } from './hooks/useSessionStorageState';
import AnnouncementsPage from './admin/features/anoucements/pages/AnnouncementsPage';
import CategoriesPage from './admin/masters/category/pages/CategoriesPage';
import BrandsPage from './admin/masters/brand/pages/BrandsPage';
import ProductsPage from './admin/features/products/pages/ProductsPage';
import BulkUpdateProductsPage from './admin/features/bulkUpdateProducts/pages/BulkUpdateProductsPage';
import DiscountsPage from './admin/features/discounts/pages/DiscountsPage';
import OrdersPage from './admin/features/orders/pages/OrdersPage';
import AdminPlaceOrderPage from './admin/features/adminPlaceOrder/pages/AdminPlaceOrderPage';
import CustomersPage from './admin/features/customers/pages/CustomersPage';
import AddUserPage from './admin/features/addUser/pages/AddUserPage';
import AbandonedCartsPage from './admin/features/abandonedCart/pages/AbandonedCartsPage';
import BannersPage from './admin/features/banners/pages/BannersPage';
import FreeCashPage from './admin/features/freeCash/pages/FreeCashPage';
import GroupsPage from './admin/masters/group/pages/GroupsPage';
import EmailTemplatesPage from './admin/masters/emailTemplate/pages/EmailTemplatesPage';
import CompanySettingsPage from './admin/features/companySettings/pages/CompanySettingsPage';
import DeliveryAgentsPage from './admin/features/deliveryAgents/pages/DeliveryAgentsPage';
import CouriersPage from './admin/masters/courier/pages/CouriersPage';
import InventoryPage from './admin/features/inventory/pages/InventoryPage';
import FreeCashUsagePage from './admin/features/freeCashUsage/pages/FreeCashUsagePage';
import SendEmailPage from './admin/features/sendEmail/pages/SendEmailPage';
import MyDeliveriesPage from './admin/features/myDeliveries/pages/MyDeliveriesPage';
import { DeliveryAgentIcon } from './components/ui/Sidebar/icons';
import { useAuth } from './admin/features/login/hooks/useAuth';
import { useAssignedModules } from './admin/modules/hooks/useAssignedModules';
import { useFeatureAccess } from './admin/modules/hooks/useFeatureAccess';
import Spinner from './components/common/Spinner';
import EmptyState from './components/common/EmptyState';
import Sidebar, { DEFAULT_NAV_ITEMS, filterNavItemsByAssignedModules, filterNavItemsByFeatureAccess } from './components/ui/Sidebar';
import { useStorefrontCompanySettings } from './client/features/companySettings/hooks/useStorefrontCompanySettings';

const PAGE_LABELS = DEFAULT_NAV_ITEMS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

// A delivery agent sees only their own deliveries - no store modules.
const AGENT_NAV_ITEMS = [{ key: 'myDeliveries', label: 'My Deliveries', icon: DeliveryAgentIcon }];

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const isDeliveryAgent = user?.role === 'deliveryAgent';
  const { assignedCodes } = useAssignedModules(isAuthenticated && !isDeliveryAgent);
  const { companySettings } = useStorefrontCompanySettings();
  // The company name is the sidebar title, with "Admin Panel" demoted to the
  // subtitle. Until the settings load (or if no name is set) the sidebar's own
  // default "Admin Panel" title shows, with no subtitle.
  const companyName = companySettings?.companyName?.trim();
  const sidebarBrand = companyName || undefined;
  const sidebarSubtitle = companyName ? 'Admin Panel' : undefined;
  const featureAccess = useFeatureAccess(isAuthenticated && !isDeliveryAgent);
  const navItems = filterNavItemsByFeatureAccess(filterNavItemsByAssignedModules(DEFAULT_NAV_ITEMS, assignedCodes), featureAccess);
  const [activePage, setActivePage] = useSessionStorageState('ecom.admin.activePage', 'announcements');
  // Customers picked on the Customers page for the Send Email module's To
  // field. Cleared when navigating anywhere through the sidebar.
  const [sendEmailPrefill, setSendEmailPrefill] = useState(null);
  const navigate = (page) => {
    setSendEmailPrefill(null);
    setActivePage(page);
  };
  const openSendEmailFor = (customers) => {
    setSendEmailPrefill(customers);
    setActivePage('sendEmail');
  };

  // The hardcoded initial 'announcements' page may not be assigned to this
  // vendor - fall back to the first section that actually is, once
  // assignedCodes has loaded (navItems is unfiltered, so this is a no-op,
  // while it's still loading).
  const isActivePageAllowed = navItems.some((item) => item.key === activePage);
  const effectiveActivePage = isActivePageAllowed ? activePage : (navItems[0]?.key ?? activePage);

  // No admin login form of its own anymore - an unauthenticated /admin visit
  // (direct nav, a dropped session, whatever) bounces to the storefront,
  // where signing in with an admin/delivery-agent account redirects back
  // here (see client/features/auth/context/AuthProvider.jsx).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isDeliveryAgent) {
    return (
      <div className="App md:flex min-h-screen bg-gray-50">
        <Sidebar items={AGENT_NAV_ITEMS} activeKey="myDeliveries" onNavigate={() => {}} user={user} onLogout={logout} brand={sidebarBrand} subtitle={sidebarSubtitle} />
        <div className="flex-1 min-w-0">
          <MyDeliveriesPage />
        </div>
      </div>
    );
  }

  return (
    <div className="App md:flex min-h-screen bg-gray-50">
      <Sidebar items={navItems} activeKey={effectiveActivePage} onNavigate={navigate} user={user} onLogout={logout} brand={sidebarBrand} subtitle={sidebarSubtitle} />

      <div className="flex-1 min-w-0">
        {effectiveActivePage === 'announcements' ? (
          <AnnouncementsPage />
        ) : effectiveActivePage === 'categories' ? (
          <CategoriesPage />
        ) : effectiveActivePage === 'brands' ? (
          <BrandsPage />
        ) : effectiveActivePage === 'products' ? (
          <ProductsPage />
        ) : effectiveActivePage === 'bulkUpdateProducts' ? (
          <BulkUpdateProductsPage />
        ) : effectiveActivePage === 'discounts' ? (
          <DiscountsPage />
        ) : effectiveActivePage === 'orders' ? (
          <OrdersPage />
        ) : effectiveActivePage === 'adminPlaceOrder' ? (
          <AdminPlaceOrderPage />
        ) : effectiveActivePage === 'customers' ? (
          <CustomersPage onAddUser={() => setActivePage('addUser')} onSendEmail={openSendEmailFor} />
        ) : effectiveActivePage === 'addUser' ? (
          <AddUserPage onDone={() => setActivePage('customers')} />
        ) : effectiveActivePage === 'deliveryAgents' ? (
          <DeliveryAgentsPage />
        ) : effectiveActivePage === 'couriers' ? (
          <CouriersPage />
        ) : effectiveActivePage === 'inventory' ? (
          <InventoryPage />
        ) : effectiveActivePage === 'freeCashUsage' ? (
          <FreeCashUsagePage />
        ) : effectiveActivePage === 'sendEmail' ? (
          // Keyed so a new hand-off from Customers starts a fresh form.
          <SendEmailPage key={sendEmailPrefill ? sendEmailPrefill.map((c) => c._id).join(',') : 'blank'} prefillCustomers={sendEmailPrefill} />
        ) : effectiveActivePage === 'abandonedCarts' ? (
          <AbandonedCartsPage />
        ) : effectiveActivePage === 'banners' ? (
          <BannersPage />
        ) : effectiveActivePage === 'freeCash' ? (
          <FreeCashPage />
        ) : effectiveActivePage === 'groups' ? (
          <GroupsPage />
        ) : effectiveActivePage === 'emailTemplates' ? (
          <EmailTemplatesPage />
        ) : effectiveActivePage === 'companySettings' ? (
          <CompanySettingsPage />
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
