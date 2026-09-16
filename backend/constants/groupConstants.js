// groupTypes that can resolve their members from an uploaded excel file
// instead of a manually-picked id list. BRAND/ORDER/CUSTOM are intentionally
// excluded (CUSTOM has no backing collection to match rows against; BRAND/ORDER
// are excel-supportable in principle but out of scope for now).
const EXCEL_UPLOAD_GROUP_TYPES = ['PRODUCT', 'CATEGORY', 'USER'];

// Sheet name each groupType's excel upload expects, mirroring the
// Discount/FreeCash convention (see discountConstants.js).
const EXCEL_SHEET_NAME_BY_GROUP_TYPE = {
  PRODUCT: 'Products',
  CATEGORY: 'Categories',
  USER: 'Users',
};

const PRODUCTS_EXCEL_COLUMNS = [
  { key: 'productName', header: 'Product Name', required: true }
];

// Category Name is always the root category; Sub Category (optional) walks
// further down the tree - one segment per nesting level, separated by ">"
// (same separator the existing category bulk-upload feature's categoryPath
// uses, e.g. "Primary>Mathematics>Algebra"). Only usable when the vendor's
// isNestingCategoryAllowedInGroup is true (see groupService.resolveCategoryPath).
const CATEGORIES_EXCEL_COLUMNS = [
  { key: 'categoryName', header: 'Category Name', required: true },
  { key: 'subCategory', header: 'Sub Category', required: false }
];

const CATEGORY_PATH_SEPARATOR = '>';

const USERS_EXCEL_COLUMNS = [
  { key: 'email', header: 'Email', required: true }
];

module.exports = {
  EXCEL_UPLOAD_GROUP_TYPES,
  EXCEL_SHEET_NAME_BY_GROUP_TYPE,
  PRODUCTS_EXCEL_COLUMNS,
  CATEGORIES_EXCEL_COLUMNS,
  USERS_EXCEL_COLUMNS,
  CATEGORY_PATH_SEPARATOR,
};
