// Why a vendor's store (storefront + admin panel) is currently closed. The
// frontend's StoreStatusGate shows a full page for each one - keep these
// values in sync with frontend/src/utils/storeStatusApi.js.
const STORE_STATUS = {
    MAINTENANCE: 'MAINTENANCE',
    PLAN_EXPIRED: 'PLAN_EXPIRED'
};

// The WebsiteMaster / CompanyMaster flag behind each status (same name in both).
const STORE_STATUS_FLAG = {
    [STORE_STATUS.MAINTENANCE]: 'showMaintenancePage',
    [STORE_STATUS.PLAN_EXPIRED]: 'showPlanExpirePage'
};

// Checked in this order - maintenance wins when both are on.
const STORE_STATUS_PRIORITY = [STORE_STATUS.MAINTENANCE, STORE_STATUS.PLAN_EXPIRED];

const STORE_STATUS_HTTP_CODE = {
    [STORE_STATUS.MAINTENANCE]: 503,
    [STORE_STATUS.PLAN_EXPIRED]: 403
};

const STORE_STATUS_MESSAGE = {
    [STORE_STATUS.MAINTENANCE]: 'This store is under maintenance. Please check back shortly.',
    [STORE_STATUS.PLAN_EXPIRED]: 'This store is currently unavailable.'
};

const STORE_OPEN_MESSAGE = 'Store is available';

// A refused request carries the status in `errors` as { field, message } (the
// shape validate.js uses), so the frontend can tell it from any other 503/403.
const STORE_STATUS_ERROR_FIELD = 'storeStatus';

// Only API calls are refused.
const STORE_API_PREFIX = '/api/';

// Still answered while the store is closed:
//  - the status endpoint itself (the frontend asks it which page to show)
//  - the public company settings read (browser tab title + icon)
//  - the payment gateway's server-to-server callback, so a payment the
//    customer already made is never lost
const STORE_STATUS_EXEMPT_PATHS = [
    '/api/store-status',
    '/api/company-settings/get-company-settings',
    '/api/payments/callback/'
];

module.exports = {
    STORE_STATUS,
    STORE_STATUS_FLAG,
    STORE_STATUS_PRIORITY,
    STORE_STATUS_HTTP_CODE,
    STORE_STATUS_MESSAGE,
    STORE_OPEN_MESSAGE,
    STORE_STATUS_ERROR_FIELD,
    STORE_API_PREFIX,
    STORE_STATUS_EXEMPT_PATHS
};
