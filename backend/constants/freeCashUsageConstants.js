// What a row of a customer's Free Cash history can be.
//   ASSIGNED - the Free Cash was given to the customer
//   USED     - spent on an order
//   REFUNDED - given back when an order was returned
//   REVOKED  - taken away by the vendor
//   RESTORED - given back after having been revoked (customer put back on the campaign)
//   EXPIRED  - no longer usable: the campaign ended, or a newer Free Cash replaced it
const FREE_CASH_EVENT_TYPES = {
    ASSIGNED: 'ASSIGNED',
    USED: 'USED',
    REFUNDED: 'REFUNDED',
    REVOKED: 'REVOKED',
    RESTORED: 'RESTORED',
    EXPIRED: 'EXPIRED'
};

// What happened to the rest of a Free Cash after it was used on an order.
//   REMAINED   - the unused part stayed with the customer
//   REMOVED    - the unused part was removed (the store doesn't keep remaining Free Cash)
//   FULLY_USED - nothing was left over
const REMAINDER_OUTCOMES = {
    REMAINED: 'REMAINED',
    REMOVED: 'REMOVED',
    FULLY_USED: 'FULLY_USED'
};

// Why a Free Cash expired.
const EXPIRY_REASONS = {
    CAMPAIGN_ENDED: 'CAMPAIGN_ENDED',
    REPLACED: 'REPLACED'
};

// Where one Free Cash of a customer stands right now.
const GRANT_STATES = {
    ACTIVE: 'ACTIVE',
    NOT_STARTED: 'NOT_STARTED',
    USED_UP: 'USED_UP',
    REVOKED: 'REVOKED',
    EXPIRED: 'EXPIRED',
    CAMPAIGN_INACTIVE: 'CAMPAIGN_INACTIVE',
    CAMPAIGN_DELETED: 'CAMPAIGN_DELETED'
};

// UserFreeCash.revokeHistory[].action
const REVOKE_ACTIONS = {
    REVOKED: 'REVOKED',
    RESTORED: 'RESTORED'
};

const VALID_REVOKE_ACTIONS = Object.values(REVOKE_ACTIONS);

// Customer list: which accounts to show, and how to order them.
const CUSTOMER_STATUS_FILTERS = ['ALL', 'A', 'I'];
const FREE_CASH_USAGE_SORTS = ['NAME', 'ACTIVE_HIGH_TO_LOW', 'ACTIVE_LOW_TO_HIGH'];

const FREE_CASH_USAGE_DEFAULT_PAGE_SIZE = 20;
const FREE_CASH_USAGE_MAX_PAGE_SIZE = 100;
const MAX_FREE_CASH_FILTER_AMOUNT = 1000000000;

// The two-level (WebsiteMaster AND CompanyMaster) switch this module needs.
const FREE_CASH_FEATURE_FLAG = 'isFreeCashFeatureOn';

module.exports = {
    FREE_CASH_EVENT_TYPES,
    REMAINDER_OUTCOMES,
    EXPIRY_REASONS,
    GRANT_STATES,
    REVOKE_ACTIONS,
    VALID_REVOKE_ACTIONS,
    CUSTOMER_STATUS_FILTERS,
    FREE_CASH_USAGE_SORTS,
    FREE_CASH_USAGE_DEFAULT_PAGE_SIZE,
    FREE_CASH_USAGE_MAX_PAGE_SIZE,
    MAX_FREE_CASH_FILTER_AMOUNT,
    FREE_CASH_FEATURE_FLAG
};
