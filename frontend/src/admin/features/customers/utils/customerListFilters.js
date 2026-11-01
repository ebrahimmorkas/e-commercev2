/**
 * Sort + filter definitions for the admin Customers list. Every value here is
 * sent to GET /users/list-customers-admin and applied on the server, so it
 * covers every customer, not just the page on screen. Mirrors
 * backend/constants/customerListConstants.js.
 */

export const DEFAULT_CUSTOMER_SORT = 'newest';

export const CUSTOMER_PAGE_SIZES = [10, 25, 50, 75, 100];
export const DEFAULT_CUSTOMER_PAGE_SIZE = 25;

export const CUSTOMER_SORT_OPTIONS = [
  { value: 'newest', label: 'Joined: Newest first' },
  { value: 'oldest', label: 'Joined: Oldest first' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'name_desc', label: 'Name: Z to A' },
  { value: 'orders_desc', label: 'Orders: Highest first' },
  { value: 'orders_asc', label: 'Orders: Lowest first' },
  { value: 'reviews_desc', label: 'Reviews: Most first' },
  { value: 'reviews_asc', label: 'Reviews: Fewest first' },
  { value: 'login_oldest', label: 'Last login: Longest ago first' },
  { value: 'login_newest', label: 'Last login: Most recent first' },
];

// Dates are 'YYYY-MM-DD' (what DatePicker gives back), in the admin's own timezone.
export const EMPTY_CUSTOMER_FILTERS = {
  status: '',
  orders: '',
  reviews: '',
  login: '',
  joinedFrom: '',
  joinedTo: '',
};

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

export const ORDERS_FILTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'has', label: 'Has orders' },
  { value: 'none', label: 'No orders' },
];

export const REVIEWS_FILTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'has', label: 'Has reviews' },
  { value: 'none', label: 'No reviews' },
];

export const LOGIN_FILTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'logged_in', label: 'Has logged in' },
  { value: 'never', label: 'Never logged in' },
];

export const optionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

const pad = (n) => String(n).padStart(2, '0');

// Date (from DatePicker) -> 'YYYY-MM-DD' in local time.
export const toDateKey = (date) => (date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '');

// 'YYYY-MM-DD' -> readable "5 Oct 2026".
export const formatDateKey = (key) =>
  key ? new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Joined date range counts as one filter.
export const countActiveFilters = (filters) =>
  [filters.status, filters.orders, filters.reviews, filters.login, filters.joinedFrom || filters.joinedTo].filter(Boolean).length;

// '' when the range is fine, else the message to show under the date pickers.
export const validateJoinedRange = (joinedFrom, joinedTo) =>
  joinedFrom && joinedTo && joinedFrom > joinedTo ? 'The "to" date cannot be before the "from" date.' : '';

// The query params the backend expects, blanks left out. The picked days run
// from the start of "from" to the very end of "to" in the admin's timezone.
export const toCustomerFilterParams = (filters) => ({
  status: filters.status || undefined,
  orders: filters.orders || undefined,
  reviews: filters.reviews || undefined,
  login: filters.login || undefined,
  joinedFrom: filters.joinedFrom ? new Date(`${filters.joinedFrom}T00:00:00`).toISOString() : undefined,
  joinedTo: filters.joinedTo ? new Date(`${filters.joinedTo}T23:59:59.999`).toISOString() : undefined,
});

// "31 Oct 2026, 04:30 pm" - Joined At / Last Login columns.
export const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
