// Describes, for every giveDiscountTo enum value, what the frontend must supply:
// - needsProductsFile / needsCategoriesFile / needsUsersFile : excel uploads (resolved via name/email lookup)
// - needsProductGroupIds / needsCategoryGroupIds / needsUserGroupIds : arrays of ObjectIds already selected via dropdown
// - notSupported : blocked for now (variant flow) until Product/Variant models exist
const GIVE_DISCOUNT_TO_CONFIG = {
  ALL_PRODUCTS_ALL_USERS: {},

  SPECIFIC_PRODUCTS_ALL_USERS: { needsProductsFile: true },
  SPECIFIC_CATEGORIES_ALL_USERS: { needsCategoriesFile: true },

  PRODUCT_GROUP_ALL_USERS: { needsProductGroupIds: true },
  CATEGORY_GROUP_ALL_USERS: { needsCategoryGroupIds: true },
  USER_GROUP: { needsUserGroupIds: true },

  ALL_PRODUCTS_SPECIFIC_USERS: { needsUsersFile: true },

  SPECIFIC_PRODUCTS_SPECIFIC_USERS: { needsProductsFile: true, needsUsersFile: true },
  SPECIFIC_CATEGORIES_SPECIFIC_USERS: { needsCategoriesFile: true, needsUsersFile: true },

  CATEGORY_GROUP_SPECIFIC_USERS: { needsCategoryGroupIds: true, needsUsersFile: true },
  PRODUCT_GROUP_SPECIFIC_USERS: { needsProductGroupIds: true, needsUsersFile: true },

  // Blocked until Product + ProductVariant models are implemented.
  PRODUCT_VARIANTS_SPECIFIC_USERS: { notSupported: true },
  PRODUCT_VARIANTS_ALL_USERS: { notSupported: true }
};

// Excel column configs, built for utils/excelParser.js's generic contract.
const PRODUCTS_EXCEL_COLUMNS = [
  { key: 'productName', header: 'Product Name', required: true }
];

const CATEGORIES_EXCEL_COLUMNS = [
  { key: 'categoryName', header: 'Category Name', required: true }
];

const USERS_EXCEL_COLUMNS = [
  { key: 'email', header: 'Email', required: true }
];

const VALID_DISCOUNT_TYPES = ['FIXED_PRICE', 'PERCENTAGE'];

const VALID_DAYS = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
];

// Gates which discount "types" (as shown on the frontend flow) a vendor may
// use, via companyMaster.allowedDiscountFeatureTypes. SPECIFIC_DAYS_HOURS_DISCOUNT
// is a superset of SPECIFIC_DAYS_DISCOUNT - required only when a discount
// restricts both days AND hours together (Hours is always a sub-option of Days).
const DISCOUNT_FEATURE_TYPES = {
  ONGOING_DISCOUNT: 'ONGOING_DISCOUNT',
  MINIMUM_QUANTITY_DISCOUNT: 'MINIMUM_QUANTITY_DISCOUNT',
  COUPON_CODE_DISCOUNT: 'COUPON_CODE_DISCOUNT',
  SCHEDULED_DISCOUNT: 'SCHEDULED_DISCOUNT',
  SPECIFIC_DAYS_DISCOUNT: 'SPECIFIC_DAYS_DISCOUNT',
  SPECIFIC_DAYS_HOURS_DISCOUNT: 'SPECIFIC_DAYS_HOURS_DISCOUNT',
  PAYMENT_METHOD_DISCOUNT: 'PAYMENT_METHOD_DISCOUNT'
};

const VALID_DISCOUNT_FEATURE_TYPES = Object.values(DISCOUNT_FEATURE_TYPES);

module.exports = {
  GIVE_DISCOUNT_TO_CONFIG,
  PRODUCTS_EXCEL_COLUMNS,
  CATEGORIES_EXCEL_COLUMNS,
  USERS_EXCEL_COLUMNS,
  VALID_DISCOUNT_TYPES,
  VALID_DAYS,
  DISCOUNT_FEATURE_TYPES,
  VALID_DISCOUNT_FEATURE_TYPES
};