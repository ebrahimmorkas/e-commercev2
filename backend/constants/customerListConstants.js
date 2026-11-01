// Admin Customers list (GET /users/list-customers-admin): paginated, searched,
// filtered and sorted on the server. Mirrored in the frontend's
// admin/features/customers/utils/customerListFilters.js.

const CUSTOMER_LIST_SORTS = {
    NEWEST: 'newest',               // joined, newest first (default)
    OLDEST: 'oldest',               // joined, oldest first
    NAME_ASC: 'name_asc',
    NAME_DESC: 'name_desc',
    ORDERS_DESC: 'orders_desc',
    ORDERS_ASC: 'orders_asc',
    REVIEWS_DESC: 'reviews_desc',
    REVIEWS_ASC: 'reviews_asc',
    LOGIN_OLDEST: 'login_oldest',   // logged in longest ago first; never logged in at the very top
    LOGIN_NEWEST: 'login_newest'    // most recent login first; never logged in at the bottom
};
const VALID_CUSTOMER_LIST_SORTS = Object.values(CUSTOMER_LIST_SORTS);
const DEFAULT_CUSTOMER_LIST_SORT = CUSTOMER_LIST_SORTS.NEWEST;

// Sorts that need every matching customer's order / review count before the
// page can be cut (the others count only the page's customers).
const COUNT_DEPENDENT_SORTS = [
    CUSTOMER_LIST_SORTS.ORDERS_DESC,
    CUSTOMER_LIST_SORTS.ORDERS_ASC,
    CUSTOMER_LIST_SORTS.REVIEWS_DESC,
    CUSTOMER_LIST_SORTS.REVIEWS_ASC
];

const CUSTOMER_LIST_PAGE_SIZES = [10, 25, 50, 75, 100];
const DEFAULT_CUSTOMER_LIST_PAGE_SIZE = 25;

// Filters. 'has' / 'none' = at least one / zero (non-deleted) orders or reviews.
const CUSTOMER_ACTIVITY_FILTERS = { HAS: 'has', NONE: 'none' };
const VALID_CUSTOMER_ACTIVITY_FILTERS = Object.values(CUSTOMER_ACTIVITY_FILTERS);

const CUSTOMER_LOGIN_FILTERS = { NEVER: 'never', LOGGED_IN: 'logged_in' };
const VALID_CUSTOMER_LOGIN_FILTERS = Object.values(CUSTOMER_LOGIN_FILTERS);

const CUSTOMER_LIST_SEARCH_MAX_LENGTH = 100;

module.exports = {
    CUSTOMER_LIST_SORTS,
    VALID_CUSTOMER_LIST_SORTS,
    DEFAULT_CUSTOMER_LIST_SORT,
    COUNT_DEPENDENT_SORTS,
    CUSTOMER_LIST_PAGE_SIZES,
    DEFAULT_CUSTOMER_LIST_PAGE_SIZE,
    CUSTOMER_ACTIVITY_FILTERS,
    VALID_CUSTOMER_ACTIVITY_FILTERS,
    CUSTOMER_LOGIN_FILTERS,
    VALID_CUSTOMER_LOGIN_FILTERS,
    CUSTOMER_LIST_SEARCH_MAX_LENGTH
};
