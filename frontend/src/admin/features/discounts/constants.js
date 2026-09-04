/**
 * Mirrors backend/constants/discountConstants.js's GIVE_DISCOUNT_TO_CONFIG and
 * companyMaster's allowedDiscountFeatureTypes / allowedDiscountTypes enums
 * exactly - this file has no runtime dependency on the backend, so if that
 * contract changes these must be updated to match by hand.
 */

// Keyed the same as backend GIVE_DISCOUNT_TO_CONFIG. `needsProductsFile` /
// `needsCategoriesFile` / `needsUsersFile` mean: the single `excelFile`
// upload must contain a sheet named "Products" / "Categories" / "Users".
// `needsProductGroupIds` / `needsCategoryGroupIds` / `needsUserGroupIds` mean:
// send that field as an array of Group._id values (groupType PRODUCT/CATEGORY/USER).
export const GIVE_DISCOUNT_TO_CONFIG = {
  ALL_PRODUCTS_ALL_USERS: {
    label: 'All Products — All Users',
    description: 'Applies storewide, to every product and every customer.',
  },
  SPECIFIC_PRODUCTS_ALL_USERS: {
    label: 'Specific Products — All Users',
    description: 'Applies only to the products listed in the uploaded excel file.',
    needsProductsFile: true,
  },
  SPECIFIC_CATEGORIES_ALL_USERS: {
    label: 'Specific Categories — All Users',
    description: 'Applies to every product inside the categories listed in the uploaded excel file.',
    needsCategoriesFile: true,
  },
  PRODUCT_GROUP_ALL_USERS: {
    label: 'Product Group — All Users',
    description: 'Applies to every product inside the selected product group(s).',
    needsProductGroupIds: true,
  },
  CATEGORY_GROUP_ALL_USERS: {
    label: 'Category Group — All Users',
    description: 'Applies to every product inside the selected category group(s).',
    needsCategoryGroupIds: true,
  },
  USER_GROUP: {
    label: 'User Group — All Products',
    description: 'Applies to every product, but only for customers in the selected user group(s).',
    needsUserGroupIds: true,
  },
  ALL_PRODUCTS_SPECIFIC_USERS: {
    label: 'All Products — Specific Users',
    description: 'Applies to every product, but only for the users listed in the uploaded excel file.',
    needsUsersFile: true,
  },
  SPECIFIC_PRODUCTS_SPECIFIC_USERS: {
    label: 'Specific Products — Specific Users',
    description: 'Applies only to the products AND only for the users listed in the uploaded excel file.',
    needsProductsFile: true,
    needsUsersFile: true,
  },
  SPECIFIC_CATEGORIES_SPECIFIC_USERS: {
    label: 'Specific Categories — Specific Users',
    description: 'Applies to products in the listed categories, only for the users listed in the uploaded excel file.',
    needsCategoriesFile: true,
    needsUsersFile: true,
  },
  CATEGORY_GROUP_SPECIFIC_USERS: {
    label: 'Category Group — Specific Users',
    description: 'Applies to the selected category group(s), only for the users listed in the uploaded excel file.',
    needsCategoryGroupIds: true,
    needsUsersFile: true,
  },
  PRODUCT_GROUP_SPECIFIC_USERS: {
    label: 'Product Group — Specific Users',
    description: 'Applies to the selected product group(s), only for the users listed in the uploaded excel file.',
    needsProductGroupIds: true,
    needsUsersFile: true,
  },
  PRODUCT_VARIANTS_SPECIFIC_USERS: {
    label: 'Product Variants — Specific Users',
    description: 'Not supported yet by the backend (variant support is pending).',
    notSupported: true,
  },
  PRODUCT_VARIANTS_ALL_USERS: {
    label: 'Product Variants — All Users',
    description: 'Not supported yet by the backend (variant support is pending).',
    notSupported: true,
  },
};

export const GIVE_DISCOUNT_TO_OPTIONS = Object.entries(GIVE_DISCOUNT_TO_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  disabled: !!cfg.notSupported,
}));

export const VALID_DISCOUNT_TYPES = ['FIXED_PRICE', 'PERCENTAGE'];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED_PRICE', label: 'Fixed Amount' },
];

// The four "discount flow" primary types are mutually exclusive on the
// backend (see discountService.resolveRequestedDiscountFeatureTypes) -
// modeled here as a single radio choice rather than 3 independent switches.
export const DISCOUNT_FLOW_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled', description: 'Runs between a fixed start and end date.', featureType: 'SCHEDULED_DISCOUNT' },
  { value: 'ONGOING', label: 'Ongoing', description: 'No start/end date - stays active until turned off.', featureType: 'ONGOING_DISCOUNT' },
  { value: 'MIN_QTY', label: 'Minimum Quantity', description: 'Only applies once the cart reaches a minimum quantity.', featureType: 'MINIMUM_QUANTITY_DISCOUNT' },
  { value: 'COUPON', label: 'Coupon Code', description: 'Customer must enter a coupon code at checkout.', featureType: 'COUPON_CODE_DISCOUNT' },
];

export const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const DAY_OPTIONS = VALID_DAYS.map((d) => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() }));

// Not a fixed backend enum (discountOnPaymentMethods is a free string array) -
// these are just sensible common defaults; the dropdown also allows freeform values.
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'COD', label: 'Cash on Delivery' },
  { value: 'CARD', label: 'Credit / Debit Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'NETBANKING', label: 'Net Banking' },
  { value: 'WALLET', label: 'Wallet' },
];

export const DISCOUNT_FEATURE_TYPES = {
  ONGOING_DISCOUNT: 'ONGOING_DISCOUNT',
  MINIMUM_QUANTITY_DISCOUNT: 'MINIMUM_QUANTITY_DISCOUNT',
  COUPON_CODE_DISCOUNT: 'COUPON_CODE_DISCOUNT',
  SCHEDULED_DISCOUNT: 'SCHEDULED_DISCOUNT',
  SPECIFIC_DAYS_DISCOUNT: 'SPECIFIC_DAYS_DISCOUNT',
  SPECIFIC_DAYS_HOURS_DISCOUNT: 'SPECIFIC_DAYS_HOURS_DISCOUNT',
  PAYMENT_METHOD_DISCOUNT: 'PAYMENT_METHOD_DISCOUNT',
};

export const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];
