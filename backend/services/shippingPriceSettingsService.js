const ShippingPriceSettings = require('../models/ShippingPriceSettings');
const Category = require('../models/Category');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const WeightMaster = require('../models/WeightMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');
const currencyService = require('./currencyService');
const { SHIPPING_PRICE_METHODS } = require('../constants/shippingPriceConstants');

// Every field that belongs to SOME method's configuration. On every
// create/update we rebuild this whole set from scratch (rather than merging
// field-by-field) so switching methods never leaves a previous method's
// rules/prices lingering on the document.
const METHOD_FIELDS = [
    'fixedPrice',
    'categoryRules', 'categoryChargeMode', 'categoryAggregation', 'categoryRestPrice',
    'countryRules', 'countryRestPrice',
    'stateRules', 'stateRestPrice',
    'cityRules', 'cityRestPrice',
    'zipRules', 'zipRestPrice',
    'weightUnit', 'weightBrackets', 'weightRestPrice'
];

// Assigning `undefined` to a Mongoose document path does NOT clear a
// previously-persisted value (only $unset/an explicit default does) - so
// switching method away from e.g. CATEGORY needs categoryRules explicitly
// reset to [] and categoryRestPrice explicitly reset to null, not left
// alone. This is each field's "not applicable to the current method" value.
const METHOD_FIELD_EMPTY_VALUE = {
    fixedPrice: null,
    categoryRules: [],
    categoryChargeMode: null,
    categoryAggregation: null,
    categoryRestPrice: null,
    countryRules: [],
    countryRestPrice: null,
    stateRules: [],
    stateRestPrice: null,
    cityRules: [],
    cityRestPrice: null,
    zipRules: [],
    zipRestPrice: null,
    weightUnit: null,
    weightBrackets: [],
    weightRestPrice: null
};

const invalidateShippingPriceSettingsCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.shippingPriceSettings(vendorId));
        logger.logInfo(1, 0, 'Shipping price settings cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

const findDuplicateKey = (rules, keyField) => {
    const seen = new Set();
    for (const rule of rules) {
        const key = rule[keyField].toString();
        if (seen.has(key)) return key;
        seen.add(key);
    }
    return null;
};

const checkBracketsForOverlap = (brackets) => {
    const sorted = [...brackets].sort((a, b) => a.minWeight - b.minWeight);
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        if (current.maxWeight !== null && current.maxWeight !== undefined && current.maxWeight < current.minWeight) {
            return `A weight bracket's maximum (${current.maxWeight}) cannot be less than its minimum (${current.minWeight}).`;
        }
        const next = sorted[i + 1];
        if (next && (current.maxWeight === null || current.maxWeight === undefined || current.maxWeight > next.minWeight)) {
            return 'Weight brackets must not overlap.';
        }
    }
    return null;
};

// Free-shipping amounts: one per country, only for countries this vendor
// serves (CompanyMaster.allowedCountries), and each country must have a
// currency - the amount is entered in it.
const validateFreeAboveRules = async (rules, companyMasterData) => {
    try {
        if (rules.length === 0) {
            return common.returnResult(true, 200, 'All good');
        }
        if (rules.some((r) => !r.countryId)) {
            return common.returnResult(false, 400, 'One or more countries were not found.');
        }
        const duplicateCountryId = findDuplicateKey(rules, 'countryId');
        if (duplicateCountryId) {
            return common.returnResult(false, 400, 'A country has more than one free shipping amount.');
        }
        const allowedCountryIds = (companyMasterData?.allowedCountries || []).map((id) => id.toString());
        if (rules.some((r) => !allowedCountryIds.includes(r.countryId.toString()))) {
            return common.returnResult(false, 400, 'Free shipping amounts can only be set for countries your store serves.');
        }
        const countries = await CountryMaster.find({ _id: { $in: rules.map((r) => r.countryId) }, status: 'A' }).select('country_name currency_id').lean();
        if (countries.length !== rules.length) {
            return common.returnResult(false, 400, 'One or more countries were not found.');
        }
        const withoutCurrency = countries.find((c) => !c.currency_id);
        if (withoutCurrency) {
            return common.returnResult(false, 400, `${withoutCurrency.country_name} has no currency set up, so a free shipping amount can't be entered for it.`);
        }
        return common.returnResult(true, 200, 'All good');
    } catch (err) {
        throw err;
    }
};

// Cross-referential + business-rule validation that Joi's shape-only checks
// can't express - existence of referenced categories/countries/states/
// cities/units, no duplicate rule keys, no overlapping weight brackets, and
// (when non-empty) that this vendor is actually allowed to use the method
// they picked.
const validateMethodConfig = async (vendorId, data, companyMasterData) => {
    try {
        const { method } = data;

        const allowedMethods = companyMasterData?.allowedShippingPriceMethods || [];
        if (allowedMethods.length > 0 && !allowedMethods.includes(method)) {
            return common.returnResult(false, 403, `The "${method}" shipping method is not available on your current plan.`);
        }

        if (method === SHIPPING_PRICE_METHODS.CATEGORY) {
            const duplicateCategoryId = findDuplicateKey(data.categoryRules, 'categoryId');
            if (duplicateCategoryId) {
                return common.returnResult(false, 400, `Category ${duplicateCategoryId} has more than one price rule.`);
            }
            const categoryIds = data.categoryRules.map((r) => r.categoryId);
            const existsCheck = await common.checkWhetherDocumentExists(Category, categoryIds, vendorId);
            if (!existsCheck.success) {
                return common.returnResult(false, 400, 'One or more categories were not found for your store.');
            }
        }

        if (method === SHIPPING_PRICE_METHODS.COUNTRY) {
            const duplicateCountryId = findDuplicateKey(data.countryRules, 'countryId');
            if (duplicateCountryId) {
                return common.returnResult(false, 400, `Country ${duplicateCountryId} has more than one price rule.`);
            }
            const countryIds = data.countryRules.map((r) => r.countryId);
            const existsCheck = await common.checkWhetherDocumentExists(CountryMaster, countryIds);
            if (!existsCheck.success) {
                return common.returnResult(false, 400, 'One or more countries were not found.');
            }
        }

        if (method === SHIPPING_PRICE_METHODS.STATE) {
            const duplicateStateId = findDuplicateKey(data.stateRules, 'stateId');
            if (duplicateStateId) {
                return common.returnResult(false, 400, `State ${duplicateStateId} has more than one price rule.`);
            }
            const stateIds = data.stateRules.map((r) => r.stateId);
            const existsCheck = await common.checkWhetherDocumentExists(StateMaster, stateIds);
            if (!existsCheck.success) {
                return common.returnResult(false, 400, 'One or more states were not found.');
            }
        }

        if (method === SHIPPING_PRICE_METHODS.CITY) {
            const duplicateCityId = findDuplicateKey(data.cityRules, 'cityId');
            if (duplicateCityId) {
                return common.returnResult(false, 400, `City ${duplicateCityId} has more than one price rule.`);
            }
            const cityIds = data.cityRules.map((r) => r.cityId);
            const existsCheck = await common.checkWhetherDocumentExists(CityMaster, cityIds);
            if (!existsCheck.success) {
                return common.returnResult(false, 400, 'One or more cities were not found.');
            }
        }

        if (method === SHIPPING_PRICE_METHODS.ZIP) {
            const seen = new Set();
            for (const rule of data.zipRules) {
                const key = rule.zipCode.trim().toLowerCase();
                if (seen.has(key)) {
                    return common.returnResult(false, 400, `Zip code ${rule.zipCode} has more than one price rule.`);
                }
                seen.add(key);
            }
        }

        if (method === SHIPPING_PRICE_METHODS.WEIGHT) {
            const allowedWeights = companyMasterData?.allowedWeights || [];
            if (!allowedWeights.some((id) => id.toString() === data.weightUnit.toString())) {
                return common.returnResult(false, 403, 'This weight unit is not assigned to your account.');
            }
            const existsCheck = await common.checkWhetherDocumentExists(WeightMaster, data.weightUnit);
            if (!existsCheck.success) {
                return common.returnResult(false, 400, 'Weight unit was not found.');
            }
            const overlapError = checkBracketsForOverlap(data.weightBrackets);
            if (overlapError) {
                return common.returnResult(false, 400, overlapError);
            }
        }

        const freeAboveCheck = await validateFreeAboveRules(data.freeAboveRules || [], companyMasterData);
        if (!freeAboveCheck.isSuccess) {
            return freeAboveCheck;
        }

        return common.returnResult(true, 200, 'All good');
    } catch (err) {
        throw err;
    }
};

const createShippingPriceSettings = async (vendorId, userId, data, companyMasterData) => {
    try {
        const existing = await ShippingPriceSettings.findOne({ vendorId });
        if (existing) {
            return common.returnResult(false, 409, 'Shipping price settings already exist for this vendor. Use update instead.');
        }

        const configCheck = await validateMethodConfig(vendorId, data, companyMasterData);
        if (!configCheck.isSuccess) {
            return configCheck;
        }

        const settingsData = { vendorId, method: data.method };
        for (const field of METHOD_FIELDS) {
            settingsData[field] = data[field] !== undefined ? data[field] : METHOD_FIELD_EMPTY_VALUE[field];
        }
        // Not method-specific: applies on top of whichever method is chosen.
        settingsData.freeAboveRules = data.freeAboveRules || [];
        settingsData.createdBy = { userID: userId, vendorID: vendorId };
        settingsData.updatedBy = { userID: userId, vendorID: vendorId };

        const settings = new ShippingPriceSettings(settingsData);
        const saved = await settings.save();

        logger.logInfo(1, 0, 'Shipping price settings created successfully', { vendorId });
        await invalidateShippingPriceSettingsCache(vendorId);

        return common.returnResult(true, 201, 'Shipping price settings created successfully', { settings: saved });
    } catch (err) {
        throw err;
    }
};

const updateShippingPriceSettings = async (vendorId, userId, data, companyMasterData) => {
    try {
        const settings = await ShippingPriceSettings.findOne({ vendorId });
        if (!settings) {
            return common.returnResult(false, 404, 'Shipping price settings not found. Please create them first.');
        }

        const configCheck = await validateMethodConfig(vendorId, data, companyMasterData);
        if (!configCheck.isSuccess) {
            return configCheck;
        }

        // Full replace of the method configuration (not a field-by-field
        // merge) - a vendor switching from, say, CATEGORY to FIXED must not
        // leave categoryRules/categoryRestPrice/etc. sitting on the document.
        settings.method = data.method;
        for (const field of METHOD_FIELDS) {
            settings[field] = data[field] !== undefined ? data[field] : METHOD_FIELD_EMPTY_VALUE[field];
        }
        settings.freeAboveRules = data.freeAboveRules || [];
        settings.updatedBy = { userID: userId, vendorID: vendorId };

        const updated = await settings.save();
        logger.logInfo(1, 0, 'Shipping price settings updated successfully', { vendorId });
        await invalidateShippingPriceSettingsCache(vendorId);

        return common.returnResult(true, 200, 'Shipping price settings updated successfully', { settings: updated });
    } catch (err) {
        throw err;
    }
};

/*
| Which currency the admin types each shipping price in (see
| shippingPriceCalculationService LOCATION PRICE CURRENCIES): country/state/city
| rules use their own country's currency (the admin page maps those from the
| countries list); this returns the two that aren't tied to a country -
| storeCurrencyCode (fixed/weight/category/zip prices, "all other states /
| cities") and otherCountriesCurrencyCode ("all other countries": the
| international currency, store currency while international pricing is off).
*/
const fetchShippingPriceCurrencies = async (companyMasterData, companySettingsData) => {
    try {
        const [storeCurrency, internationalCurrency] = await Promise.all([
            currencyService.getStoreCurrency(companySettingsData),
            currencyService.fetchActiveInternationalCurrency({ companyMasterData, companySettingsData })
        ]);
        const storeCurrencyCode = storeCurrency ? storeCurrency.short_name : null;
        return common.returnResult(true, 200, 'Shipping price currencies fetched successfully', {
            storeCurrencyCode,
            otherCountriesCurrencyCode: internationalCurrency ? internationalCurrency.code : storeCurrencyCode
        });
    } catch (err) {
        throw err;
    }
};

const fetchShippingPriceSettingsByVendorId = async (vendorId) => {
    try {
        logger.logInfo(null, null, 'Fetching shipping price settings from DB', { vendorId });
        const settings = await ShippingPriceSettings.findOne({ vendorId });
        if (!settings) {
            logger.logInfo(0, 1, 'Shipping price settings not found', { vendorId });
            return null;
        }
        logger.logInfo(1, 0, 'Shipping price settings fetched successfully', { vendorId });
        return settings;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchShippingPriceCurrencies,
    createShippingPriceSettings,
    updateShippingPriceSettings,
    fetchShippingPriceSettingsByVendorId
};
