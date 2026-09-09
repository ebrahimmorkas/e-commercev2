// The full set of shipping-price-calculation methods the platform supports.
// A vendor is restricted to a subset of these via
// CompanyMaster.allowedShippingPriceMethods (same "platform decides what a
// vendor may use" convention as discountConstants.js's
// allowedDiscountFeatureTypes), and picks exactly ONE as their active method
// on ShippingPriceSettings.method - methods are never combined/layered.
const SHIPPING_PRICE_METHODS = {
    FREE: 'FREE',
    FIXED: 'FIXED',
    CATEGORY: 'CATEGORY',
    COUNTRY: 'COUNTRY',
    STATE: 'STATE',
    CITY: 'CITY',
    ZIP: 'ZIP',
    WEIGHT: 'WEIGHT',
    FREE_ABOVE: 'FREE_ABOVE'
};

const VALID_SHIPPING_PRICE_METHODS = Object.values(SHIPPING_PRICE_METHODS);

const CATEGORY_CHARGE_MODES = ['PER_ITEM', 'ONE_TIME'];
const CATEGORY_AGGREGATIONS = ['SUM', 'HIGHEST', 'AVERAGE'];

module.exports = {
    SHIPPING_PRICE_METHODS,
    VALID_SHIPPING_PRICE_METHODS,
    CATEGORY_CHARGE_MODES,
    CATEGORY_AGGREGATIONS
};
