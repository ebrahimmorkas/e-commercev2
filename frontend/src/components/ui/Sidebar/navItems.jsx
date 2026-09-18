import {
  DashboardIcon,
  ProductsIcon,
  BulkUpdateProductsIcon,
  CategoriesIcon,
  BrandIcon,
  OrdersIcon,
  CustomersIcon,
  AddUserIcon,
  DiscountIcon,
  BannerIcon,
  AnnouncementIcon,
  CompanySettingsIcon,
  AbandonedCartIcon,
  FreeCashIcon,
  GroupIcon,
} from './icons';

// moduleCode ties each nav item to its backend ModuleMaster.code (see
// backend/seeds/seedModuleMaster.js) - filterNavItemsByAssignedModules uses
// it to hide a section the vendor's admin isn't currently assigned.
export const DEFAULT_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, moduleCode: 'DASHBOARD' },
  { key: 'products', label: 'Products', icon: ProductsIcon, moduleCode: 'PRODUCTS' },
  { key: 'bulkUpdateProducts', label: 'Bulk Update Products', icon: BulkUpdateProductsIcon, moduleCode: 'BULK_UPDATE_PRODUCTS' },
  { key: 'categories', label: 'Categories', icon: CategoriesIcon, moduleCode: 'CATEGORIES' },
  { key: 'brands', label: 'Brand Master', icon: BrandIcon, moduleCode: 'BRAND' },
  { key: 'orders', label: 'Orders', icon: OrdersIcon, moduleCode: 'ORDERS' },
  { key: 'customers', label: 'Customers', icon: CustomersIcon, moduleCode: 'CUSTOMERS' },
  { key: 'addUser', label: 'Add User', icon: AddUserIcon, moduleCode: 'ADD_USER' },
  { key: 'discounts', label: 'Discount', icon: DiscountIcon, moduleCode: 'DISCOUNT' },
  { key: 'banners', label: 'Banner', icon: BannerIcon, moduleCode: 'BANNER' },
  { key: 'announcements', label: 'Announcement', icon: AnnouncementIcon, moduleCode: 'ANNOUNCEMENT' },
  { key: 'abandonedCarts', label: 'Abandoned Carts', icon: AbandonedCartIcon, moduleCode: 'ABANDONED_CART' },
  { key: 'freeCash', label: 'Free Cash', icon: FreeCashIcon, moduleCode: 'FREE_CASH' },
  { key: 'groups', label: 'Groups', icon: GroupIcon, moduleCode: 'GROUP' },
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
