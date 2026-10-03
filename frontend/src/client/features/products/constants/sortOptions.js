// The sorts the backend product list endpoints accept (productService PRODUCT_LIST_SORTS).
export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

export const DEFAULT_SORT = 'featured';

export const isValidSort = (value) => SORT_OPTIONS.some((option) => option.value === value);
