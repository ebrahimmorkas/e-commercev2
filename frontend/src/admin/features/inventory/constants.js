// Mirrors backend/constants/inventoryConstants.js.

export const STOCK_OPERATIONS = {
  INCREASE: 'INCREASE',
  DEDUCT: 'DEDUCT',
};

export const STOCK_LEVEL_LABELS = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

export const SORT_OPTIONS = [
  { value: 'NAME', label: 'Product name (A to Z)' },
  { value: 'STOCK_LOW_TO_HIGH', label: 'Stock: low to high' },
  { value: 'STOCK_HIGH_TO_LOW', label: 'Stock: high to low' },
];

export const LOG_TYPE_LABELS = {
  INITIAL: 'Opening stock',
  INCREASE: 'Increased',
  DEDUCT: 'Deducted',
};

export const LOG_TYPE_OPTIONS = [
  { value: 'INITIAL', label: 'Opening stock' },
  { value: 'INCREASE', label: 'Increased' },
  { value: 'DEDUCT', label: 'Deducted' },
];

export const MAX_ADJUST_QUANTITY = 1000000;
export const MAX_REMARK_LENGTH = 500;
export const MAX_BULK_ADJUST_ITEMS = 100;
export const INVENTORY_PAGE_SIZE = 20;
export const INVENTORY_LOG_PAGE_SIZE = 20;
