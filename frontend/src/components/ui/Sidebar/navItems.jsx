import {
  DashboardIcon,
  ProductsIcon,
  BulkUpdateProductsIcon,
  InventoryIcon,
  CategoriesIcon,
  BrandIcon,
  OrdersIcon,
  PlaceOrderIcon,
  CustomersIcon,
  AddUserIcon,
  DeliveryAgentIcon,
  CourierIcon,
  DiscountIcon,
  BannerIcon,
  AnnouncementIcon,
  CompanySettingsIcon,
  AbandonedCartIcon,
  FreeCashIcon,
  GroupIcon,
  EmailTemplateIcon,
  SendEmailIcon,
} from './icons';

// moduleCode ties each nav item to its backend ModuleMaster.code (see
// backend/seeds/seedModuleMaster.js) - filterNavItemsByAssignedModules uses
// it to hide a section the vendor's admin isn't currently assigned.
export const DEFAULT_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, moduleCode: 'DASHBOARD' },
  { key: 'products', label: 'Products', icon: ProductsIcon, moduleCode: 'PRODUCTS' },
  { key: 'bulkUpdateProducts', label: 'Bulk Update Products', icon: BulkUpdateProductsIcon, moduleCode: 'BULK_UPDATE_PRODUCTS', featureFlag: 'isBulkUpdatingProductsAllowed' },
  { key: 'inventory', label: 'Inventory', icon: InventoryIcon, moduleCode: 'INVENTORY' },
  { key: 'categories', label: 'Categories', icon: CategoriesIcon, moduleCode: 'CATEGORIES', featureFlag: 'isCategoryFeatureOn' },
  { key: 'brands', label: 'Brand Master', icon: BrandIcon, moduleCode: 'BRAND', featureFlag: 'isBrandFeatureOn' },
  { key: 'orders', label: 'Orders', icon: OrdersIcon, moduleCode: 'ORDERS' },
  { key: 'adminPlaceOrder', label: 'Place Order', icon: PlaceOrderIcon, moduleCode: 'ADMIN_PLACE_ORDER', featureFlag: 'isAdminPlacingOrderOnBehalfOfUserIsOn' },
  { key: 'customers', label: 'Customers', icon: CustomersIcon, moduleCode: 'CUSTOMERS' },
  { key: 'addUser', label: 'Add User', icon: AddUserIcon, moduleCode: 'ADD_USER', featureFlag: 'isAdminAddingUserFeatureAllowed' },
  { key: 'deliveryAgents', label: 'Delivery Agents', icon: DeliveryAgentIcon, moduleCode: 'DELIVERY_AGENTS', featureFlag: 'deliveryAgentsEnabled' },
  { key: 'couriers', label: 'Courier Master', icon: CourierIcon, moduleCode: 'COURIER', featureFlag: 'isCourierFeatureOn' },
  { key: 'discounts', label: 'Discount', icon: DiscountIcon, moduleCode: 'DISCOUNT', featureFlag: 'isDiscountFeatureOn' },
  { key: 'banners', label: 'Banner', icon: BannerIcon, moduleCode: 'BANNER', featureFlag: 'isBannerFeatureOn' },
  { key: 'announcements', label: 'Announcement', icon: AnnouncementIcon, moduleCode: 'ANNOUNCEMENT', featureFlag: 'isAnnouncementFeatureOn' },
  { key: 'abandonedCarts', label: 'Abandoned Carts', icon: AbandonedCartIcon, moduleCode: 'ABANDONED_CART', featureFlag: 'isAbondonedCartFeatureOn' },
  { key: 'freeCash', label: 'Free Cash', icon: FreeCashIcon, moduleCode: 'FREE_CASH', featureFlag: 'isFreeCashFeatureOn' },
  { key: 'groups', label: 'Groups', icon: GroupIcon, moduleCode: 'GROUP', featureFlag: 'isGroupFeatureOn' },
  { key: 'emailTemplates', label: 'Email Templates', icon: EmailTemplateIcon, moduleCode: 'EMAIL_TEMPLATE', featureFlag: 'isEmailTemplateFeatureOn' },
  { key: 'sendEmail', label: 'Send Email', icon: SendEmailIcon, moduleCode: 'SEND_EMAIL', featureFlag: 'isSendEmailModuleOn' },
  { key: 'companySettings', label: 'Company Settings', icon: CompanySettingsIcon, moduleCode: 'COMPANY_SETTINGS' },
];

/**
 * Filters nav items down to ones whose moduleCode is currently assigned.
 * `assignedCodes` null (still loading, or the lookup failed) means "unknown"
 * - fail open and show every item rather than blanking the sidebar.
 *
 * @param {Array} items
 * @param {Set<string>|null} assignedCodes
 */
export const filterNavItemsByAssignedModules = (items, assignedCodes) => {
  if (!assignedCodes) return items;
  return items.filter((item) => !item.moduleCode || assignedCodes.has(item.moduleCode));
};

/**
 * Hides nav items whose featureFlag is switched off for this vendor (vendor
 * flag AND platform flag - see useFeatureAccess). `featureAccess` null means
 * still loading / lookup failed: show everything.
 *
 * @param {Array} items
 * @param {Object<string, boolean>|null} featureAccess
 */
export const filterNavItemsByFeatureAccess = (items, featureAccess) => {
  if (!featureAccess) return items;
  return items.filter((item) => !item.featureFlag || featureAccess[item.featureFlag] !== false);
};
