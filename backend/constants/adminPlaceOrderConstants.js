// Single source of truth for the "search user by" dropdown on the admin
// place-order screen. The frontend never hardcodes these - it reads them
// from GET /api/admin-place-order/user-search-fields. Adding a new option
// means adding one entry here (userField must be a real User schema field).
const USER_SEARCH_FIELDS = [
    { key: 'name', label: 'Name', userField: 'name' },
    { key: 'username', label: 'Username', userField: 'username' },
    { key: 'email', label: 'Email', userField: 'email' },
    { key: 'phone', label: 'Phone', userField: 'phone_no' },
    { key: 'whatsapp', label: 'WhatsApp', userField: 'whatsapp_no' }
];

const VALID_USER_SEARCH_FIELD_KEYS = USER_SEARCH_FIELDS.map((field) => field.key);

// The user picker is a plain shared Dropdown (client-side search), so it needs
// the whole list up front rather than a small type-ahead page.
const USER_DROPDOWN_DEFAULT_LIMIT = 1000;
const USER_DROPDOWN_MAX_LIMIT = 1000;

const MAX_ORDER_LINE_ITEMS = 50;
const MAX_LINE_ITEM_QUANTITY = 100000;

module.exports = {
    USER_SEARCH_FIELDS,
    VALID_USER_SEARCH_FIELD_KEYS,
    USER_DROPDOWN_DEFAULT_LIMIT,
    USER_DROPDOWN_MAX_LIMIT,
    MAX_ORDER_LINE_ITEMS,
    MAX_LINE_ITEM_QUANTITY
};
