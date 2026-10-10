// What an InventoryLog row records.
//   INITIAL  - the stock a size was created with (product add / bulk upload / clone)
//   INCREASE - stock added from the Inventory module
//   DEDUCT   - stock taken off from the Inventory module
const INVENTORY_LOG_TYPES = {
    INITIAL: 'INITIAL',
    INCREASE: 'INCREASE',
    DEDUCT: 'DEDUCT'
};

const VALID_INVENTORY_LOG_TYPES = Object.values(INVENTORY_LOG_TYPES);

// The two things a vendor can do to stock from the Inventory module.
const STOCK_OPERATIONS = {
    INCREASE: 'INCREASE',
    DEDUCT: 'DEDUCT'
};

const VALID_STOCK_OPERATIONS = Object.values(STOCK_OPERATIONS);

// Inventory list filter (the "Stock level" dropdown).
const STOCK_FILTERS = {
    ALL: 'ALL',
    IN_STOCK: 'IN_STOCK',
    LOW_STOCK: 'LOW_STOCK',
    OUT_OF_STOCK: 'OUT_OF_STOCK'
};

const VALID_STOCK_FILTERS = Object.values(STOCK_FILTERS);

// Limits shared by the Joi schemas and the service.
const MAX_ADJUST_QUANTITY = 1000000;
const MAX_STOCK_PER_SIZE = 100000000;
const MAX_REMARK_LENGTH = 500;
const MAX_BULK_ADJUST_ITEMS = 100;
const MAX_LOW_STOCK_THRESHOLD = 1000000;
const INVENTORY_DEFAULT_PAGE_SIZE = 20;
const INVENTORY_MAX_PAGE_SIZE = 100;

// The two-level (WebsiteMaster AND CompanyMaster) switch for low stock alert emails.
const LOW_STOCK_ALERT_FEATURE_FLAG = 'isReceivingLowStockAlertFeatureOn';

// Used for the Inventory low stock indicator when the vendor has no threshold
// of their own, and DEFAULT_LOW_STOCK_THRESHOLD is missing from .env.
const FALLBACK_LOW_STOCK_THRESHOLD = 5;

// EmailLog.module of the low stock alert email.
const LOW_STOCK_ALERT_EMAIL_MODULE = 'lowStockAlert';

module.exports = {
    INVENTORY_LOG_TYPES,
    VALID_INVENTORY_LOG_TYPES,
    STOCK_OPERATIONS,
    VALID_STOCK_OPERATIONS,
    STOCK_FILTERS,
    VALID_STOCK_FILTERS,
    MAX_ADJUST_QUANTITY,
    MAX_STOCK_PER_SIZE,
    MAX_REMARK_LENGTH,
    MAX_BULK_ADJUST_ITEMS,
    MAX_LOW_STOCK_THRESHOLD,
    INVENTORY_DEFAULT_PAGE_SIZE,
    INVENTORY_MAX_PAGE_SIZE,
    LOW_STOCK_ALERT_FEATURE_FLAG,
    FALLBACK_LOW_STOCK_THRESHOLD,
    LOW_STOCK_ALERT_EMAIL_MODULE
};
