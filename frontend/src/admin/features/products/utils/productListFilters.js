/**
 * Filter + sort definitions for the admin product list. Every value here is
 * sent to GET /products/get-products-admin and applied on the server, so a
 * filter covers the whole catalogue, not just the page on screen.
 */

export const DEFAULT_PRODUCT_SORT = 'newest';

// Page sizes the admin can pick. The vendor's default is Company Settings >
// Product (adminProductsPerPage), applied by the server when no limit is sent.
export const ADMIN_PRODUCT_PAGE_SIZES = [10, 25, 50, 75, 100];
export const DEFAULT_ADMIN_PRODUCTS_PER_PAGE = 25;

export const PRODUCT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'name_desc', label: 'Name: Z to A' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'stock_asc', label: 'Stock: Low to High' },
  { value: 'stock_desc', label: 'Stock: High to Low' },
];

// mainCategory/subCategory mirror CategoryPathPicker: subCategory is the
// deepest pick (any depth). Prices and stock are strings straight from the
// inputs. The stock range (min = max = exact) and stockStatus are one OR the other.
export const EMPTY_PRODUCT_FILTERS = {
  mainCategory: '',
  subCategory: '',
  minPrice: '',
  maxPrice: '',
  stockStatus: '',
  minStock: '',
  maxStock: '',
};

// Stock status is the product's TOTAL stock across all sizes (the Stock column).
export const getStockStatusOptions = (lowStockThreshold) => [
  { value: 'in_stock', label: 'In stock', hint: lowStockThreshold == null ? 'Healthy stock' : `More than ${lowStockThreshold}` },
  { value: 'low_stock', label: 'Low stock', hint: lowStockThreshold == null ? 'Running low' : lowStockThreshold <= 1 ? 'Exactly 1' : `1 to ${lowStockThreshold}` },
  { value: 'out_of_stock', label: 'Out of stock', hint: 'Total stock is 0' },
];

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

// The category the server filters by: the deepest pick, which also matches everything below it.
export const selectedCategoryId = (filters) => filters.subCategory || filters.mainCategory || '';

export const hasStockRange = (filters) => !isBlank(filters.minStock) || !isBlank(filters.maxStock);

// Stock status and stock range count as one "Stock" filter.
export const countActiveFilters = (filters) =>
  [
    selectedCategoryId(filters),
    !isBlank(filters.minPrice) || !isBlank(filters.maxPrice),
    filters.stockStatus || hasStockRange(filters),
  ].filter(Boolean).length;

// The query params the backend expects, blanks left out.
export const toProductFilterParams = (filters) => ({
  categoryId: selectedCategoryId(filters) || undefined,
  minPrice: isBlank(filters.minPrice) ? undefined : Number(filters.minPrice),
  maxPrice: isBlank(filters.maxPrice) ? undefined : Number(filters.maxPrice),
  stockStatus: filters.stockStatus || undefined,
  minStock: isBlank(filters.minStock) ? undefined : Number(filters.minStock),
  maxStock: isBlank(filters.maxStock) ? undefined : Number(filters.maxStock),
});

// '' when the range is fine, else the message to show under the price inputs.
export const validatePriceRange = (minPrice, maxPrice) => {
  const min = isBlank(minPrice) ? null : Number(minPrice);
  const max = isBlank(maxPrice) ? null : Number(maxPrice);
  if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) {
    return 'Prices must be 0 or more.';
  }
  if (min !== null && max !== null && min > max) return 'Max price must be greater than or equal to min price.';
  return '';
};

// Same for the stock inputs - stock is a whole number.
export const validateStockRange = (minStock, maxStock) => {
  const min = isBlank(minStock) ? null : Number(minStock);
  const max = isBlank(maxStock) ? null : Number(maxStock);
  if ((min !== null && (!Number.isInteger(min) || min < 0)) || (max !== null && (!Number.isInteger(max) || max < 0))) {
    return 'Stock must be a whole number, 0 or more.';
  }
  if (min !== null && max !== null && min > max) return 'Max stock must be greater than or equal to min stock.';
  return '';
};
