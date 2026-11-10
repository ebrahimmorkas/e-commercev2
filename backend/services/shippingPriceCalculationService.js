const mongoose = require('mongoose');
const common = require('../utils/common');
const weightMasterService = require('./weightMasterService');
const currencyService = require('./currencyService');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const exchangeRateService = require('./exchangeRateService');
const { SHIPPING_PRICE_METHODS } = require('../constants/shippingPriceConstants');

const round2 = (n) => Math.round(n * 100) / 100;

// Resolves a cart line item's shipping category: subCategory first, falling
// back to mainCategory when the vendor has no rule for the subCategory
// (confirmed convention - see categoryRules on ShippingPriceSettings).
const resolveCategoryIdForItem = (item, categoryRules) => {
    try {
        const subMatch = categoryRules.find((r) => r.categoryId.toString() === item.subCategoryId?.toString());
        if (subMatch || !item.mainCategoryId) {
            return item.subCategoryId ? item.subCategoryId.toString() : null;
        }
        const mainMatch = categoryRules.find((r) => r.categoryId.toString() === item.mainCategoryId.toString());
        if (mainMatch) {
            return item.mainCategoryId.toString();
        }
        // Neither matched a rule - still grouped by its own subCategory (falls
        // back to categoryRestPrice), so distinct unmatched categories remain
        // distinct groups for SUM/HIGHEST/AVERAGE aggregation purposes.
        return item.subCategoryId ? item.subCategoryId.toString() : item.mainCategoryId.toString();
    } catch (err) {
        throw err;
    }
};

const calculateCategoryAmount = (companyItems, settings) => {
    try {
        const { categoryRules, categoryChargeMode, categoryRestPrice, categoryAggregation } = settings;

        const groups = new Map();
        for (const item of companyItems) {
            const groupKey = resolveCategoryIdForItem(item, categoryRules);
            const group = groups.get(groupKey) || { quantity: 0 };
            group.quantity += item.quantity;
            groups.set(groupKey, group);
        }

        const resolvedAmounts = [];
        for (const [groupKey, group] of groups) {
            const rule = categoryRules.find((r) => r.categoryId.toString() === groupKey);
            const price = rule ? rule.price : categoryRestPrice;
            const resolvedAmount = categoryChargeMode === 'PER_ITEM' ? price * group.quantity : price;
            resolvedAmounts.push(resolvedAmount);
        }

        if (resolvedAmounts.length === 0) return 0;

        if (categoryAggregation === 'SUM') {
            return resolvedAmounts.reduce((sum, a) => sum + a, 0);
        }
        if (categoryAggregation === 'HIGHEST') {
            return Math.max(...resolvedAmounts);
        }
        // AVERAGE
        return resolvedAmounts.reduce((sum, a) => sum + a, 0) / resolvedAmounts.length;
    } catch (err) {
        throw err;
    }
};

/*
| LOCATION PRICE CURRENCIES
| Country/state/city rule prices are entered in the currency of the country
| they belong to (CountryMaster.currency_id; a country with none -> store
| currency). "Price for all other countries" is in the international currency
| (store currency while international pricing is off); "all other states /
| cities" stay in store currency. Everything here is returned in STORE currency
| (converted at the live rate) - null = no fresh rate, the price can't be known.
*/
const toStoreAmount = async (amount, currencyCode, companySettingsData) => {
    try {
        if (!amount) return 0;
        const storeCurrency = await currencyService.getStoreCurrency(companySettingsData);
        if (!currencyCode || !storeCurrency || currencyCode === storeCurrency.short_name) return amount;
        // rate = currencyCode units per 1 store-currency unit.
        const rate = await exchangeRateService.getFreshRate(storeCurrency.short_name, currencyCode);
        return rate ? amount / rate.rate : null;
    } catch (err) {
        throw err;
    }
};

const countryCurrencyCode = async (countryId) => {
    try {
        if (!countryId) return null;
        const currency = await currencyService.getCountryCurrency(countryId);
        return currency ? currency.short_name : null;
    } catch (err) {
        throw err;
    }
};

const calculateCountryAmount = async (settings, countryId, companyMasterData, companySettingsData) => {
    try {
        const match = countryId ? settings.countryRules.find((r) => r.countryId.toString() === countryId.toString()) : null;
        if (match) {
            return await toStoreAmount(match.price, await countryCurrencyCode(match.countryId), companySettingsData);
        }
        const internationalCurrency = await currencyService.fetchActiveInternationalCurrency({ companyMasterData, companySettingsData });
        return await toStoreAmount(settings.countryRestPrice || 0, internationalCurrency ? internationalCurrency.code : null, companySettingsData);
    } catch (err) {
        throw err;
    }
};

const calculateStateAmount = async (settings, stateId, companySettingsData) => {
    try {
        const match = stateId ? settings.stateRules.find((r) => r.stateId.toString() === stateId.toString()) : null;
        if (!match) return settings.stateRestPrice || 0;
        const state = await StateMaster.findById(match.stateId).select('country_id').lean();
        return await toStoreAmount(match.price, await countryCurrencyCode(state?.country_id), companySettingsData);
    } catch (err) {
        throw err;
    }
};

const calculateCityAmount = async (settings, cityId, companySettingsData) => {
    try {
        const match = cityId ? settings.cityRules.find((r) => r.cityId.toString() === cityId.toString()) : null;
        if (!match) return settings.cityRestPrice || 0;
        const city = await CityMaster.findById(match.cityId).select('state_id').lean();
        const state = city ? await StateMaster.findById(city.state_id).select('country_id').lean() : null;
        return await toStoreAmount(match.price, await countryCurrencyCode(state?.country_id), companySettingsData);
    } catch (err) {
        throw err;
    }
};

// Sums companyItems' weight, converting each item into the SAME dimension
// (MASS/VOLUME) as the vendor's configured weightUnit via
// WeightMaster.conversionFactor, then matches the total into weightBrackets
// (expressed in the vendor's configured unit). An item whose unit is
// unknown or belongs to the OTHER dimension is excluded from the sum
// entirely (never blocks checkout, just doesn't count toward the total) -
// there is no meaningful conversion between MASS and VOLUME.
const calculateWeightAmount = async (companyItems, settings) => {
    try {
        const { weightUnit, weightBrackets, weightRestPrice } = settings;

        const weightMasterMap = await weightMasterService.fetchWeightMasterMap();
        const configuredUnit = weightMasterMap.get(weightUnit.toString());
        if (!configuredUnit) {
            return weightRestPrice || 0;
        }

        let totalInBaseUnit = 0;
        for (const item of companyItems) {
            if (!item.weight || !item.weight.unit) continue;
            const itemUnit = weightMasterMap.get(item.weight.unit.toString());
            if (!itemUnit || itemUnit.type !== configuredUnit.type) continue;
            totalInBaseUnit += item.weight.value * itemUnit.conversionFactor * item.quantity;
        }

        const totalInConfiguredUnit = totalInBaseUnit / configuredUnit.conversionFactor;

        const bracket = weightBrackets.find((b) =>
            totalInConfiguredUnit >= b.minWeight && (b.maxWeight === null || b.maxWeight === undefined || totalInConfiguredUnit <= b.maxWeight)
        );

        return bracket ? bracket.price : (weightRestPrice || 0);
    } catch (err) {
        throw err;
    }
};

/*
| The free-shipping-above amount for the delivery country, in STORE currency
| (the currency every subtotal here is in), or null = no free shipping.
| settings.freeAboveRules holds one { countryId, threshold } per country, the
| threshold in THAT country's currency, so it is converted at the live rate.
| Country unknown -> the store country's rule. No rule for the country, a
| country with no currency, or no fresh exchange rate -> null (normal shipping
| is charged rather than guessing).
*/
const resolveFreeAboveThreshold = async (shippingPriceSettings, countryId, companySettingsData) => {
    try {
        const rules = shippingPriceSettings?.freeAboveRules || [];
        if (rules.length === 0) return null;

        const effectiveCountryId = countryId || companySettingsData?.storeCountryId || null;
        if (!effectiveCountryId || !mongoose.Types.ObjectId.isValid(effectiveCountryId)) return null;
        const rule = rules.find((r) => r.countryId.toString() === effectiveCountryId.toString());
        if (!rule || !(rule.threshold > 0)) return null;

        const [storeCurrency, countryCurrency] = await Promise.all([
            currencyService.getStoreCurrency(companySettingsData),
            currencyService.getCountryCurrency(effectiveCountryId)
        ]);
        if (!storeCurrency || !countryCurrency) return null;

        // rate = country-currency units per 1 store-currency unit.
        const rate = await exchangeRateService.getFreshRate(storeCurrency.short_name, countryCurrency.short_name);
        if (!rate) return null;
        return rule.threshold / rate.rate;
    } catch (err) {
        throw err;
    }
};

/*
| Computes the shipping-price contribution of a cart's COMPANY_SETTINGS-priced
| line items (per the vendor's single active ShippingPriceSettings.method),
| plus the flat sum of any CUSTOM-priced line items, per unit x quantity.
| Free shipping above (settings.freeAboveRules, one amount per country in that
| country's currency - see resolveFreeAboveThreshold): when the subtotal reaches
| it, the order ships free whatever the method - breakdown.isFreeAboveApplied.
| CUSTOM (manual) method: contributes 0 and sets breakdown.isShippingPending.
| Location methods (COUNTRY/STATE/CITY/ZIP) charge the matching rule's
| price, or the "rest" price for any place with no rule (country/state/city
| prices converted from their own currency - see LOCATION PRICE CURRENCIES;
| no rate -> shippingAmount null + breakdown.isRateUnavailable).
| Returns 0 gracefully (never errors) whenever the feature is off or
| unconfigured, so a missing/disabled shipping-price setup never blocks
| checkout.
|
| lineItems: [{ shippingType: 'CUSTOM'|'COMPANY_SETTINGS'|null, shippingValue,
|               mainCategoryId, subCategoryId, weight: {value, unit}|null, quantity }]
*/
const calculateShippingPriceAmount = async ({ lineItems, subtotal, shippingPriceSettings, locationContext, companyMasterData, websiteMasterData, companySettingsData }) => {
    try {
        const customItems = lineItems.filter((i) => i.shippingType === 'CUSTOM');
        const companyItems = lineItems.filter((i) => i.shippingType !== 'CUSTOM');

        const customAmount = customItems.reduce((sum, i) => sum + (i.shippingValue || 0) * i.quantity, 0);

        const featureOn = !!(websiteMasterData?.isShippingPriceFeatureOn && companyMasterData?.isShippingPriceFeatureOn);

        // Free shipping above the delivery country's order amount overrides
        // every method (and any per-product custom charge): the order simply
        // ships free. Only while the shipping price feature is on.
        const freeAboveThreshold = featureOn && shippingPriceSettings
            ? await resolveFreeAboveThreshold(shippingPriceSettings, locationContext?.countryId, companySettingsData)
            : null;
        if (freeAboveThreshold !== null && subtotal >= freeAboveThreshold) {
            return common.returnResult(true, 200, 'Shipping price calculated successfully', {
                shippingAmount: 0,
                breakdown: { customAmount: 0, companyAmount: 0, method: shippingPriceSettings.method, isShippingPending: false, isFreeAboveApplied: true }
            });
        }

        if (!featureOn || !shippingPriceSettings || companyItems.length === 0) {
            return common.returnResult(true, 200, 'Shipping price calculated successfully', {
                shippingAmount: round2(customAmount),
                breakdown: { customAmount: round2(customAmount), companyAmount: 0, method: shippingPriceSettings?.method || null, isShippingPending: false }
            });
        }

        let companyAmount = 0;
        let isShippingPending = false;
        switch (shippingPriceSettings.method) {
            case SHIPPING_PRICE_METHODS.FREE:
                companyAmount = 0;
                break;
            case SHIPPING_PRICE_METHODS.FIXED:
                companyAmount = shippingPriceSettings.fixedPrice || 0;
                break;
            case SHIPPING_PRICE_METHODS.CATEGORY:
                companyAmount = calculateCategoryAmount(companyItems, shippingPriceSettings);
                break;
            case SHIPPING_PRICE_METHODS.COUNTRY:
                companyAmount = await calculateCountryAmount(shippingPriceSettings, locationContext?.countryId, companyMasterData, companySettingsData);
                break;
            case SHIPPING_PRICE_METHODS.STATE:
                companyAmount = await calculateStateAmount(shippingPriceSettings, locationContext?.stateId, companySettingsData);
                break;
            case SHIPPING_PRICE_METHODS.CITY:
                companyAmount = await calculateCityAmount(shippingPriceSettings, locationContext?.cityId, companySettingsData);
                break;
            case SHIPPING_PRICE_METHODS.ZIP: {
                const zipCode = locationContext?.zipCode;
                const match = zipCode ? shippingPriceSettings.zipRules.find((r) => r.zipCode.trim().toLowerCase() === zipCode.trim().toLowerCase()) : null;
                companyAmount = match ? match.price : (shippingPriceSettings.zipRestPrice || 0);
                break;
            }
            case SHIPPING_PRICE_METHODS.WEIGHT:
                companyAmount = await calculateWeightAmount(companyItems, shippingPriceSettings);
                break;
            case SHIPPING_PRICE_METHODS.CUSTOM:
                // Entered manually when the order is confirmed - nothing to
                // calculate now, so it contributes 0 and is flagged pending.
                companyAmount = 0;
                isShippingPending = true;
                break;
            default:
                companyAmount = 0;
        }

        // A price in another currency with no fresh exchange rate: the amount
        // can't be known (estimate shows "Calculated at checkout", an order
        // can't be placed until a rate is available).
        if (companyAmount === null) {
            return common.returnResult(true, 200, 'Shipping price calculated successfully', {
                shippingAmount: null,
                breakdown: { customAmount: round2(customAmount), companyAmount: null, method: shippingPriceSettings.method, isShippingPending: false, isRateUnavailable: true }
            });
        }

        const shippingAmount = round2(customAmount + companyAmount);

        return common.returnResult(true, 200, 'Shipping price calculated successfully', {
            shippingAmount,
            breakdown: { customAmount: round2(customAmount), companyAmount: round2(companyAmount), method: shippingPriceSettings.method, isShippingPending }
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    calculateShippingPriceAmount,
    resolveFreeAboveThreshold
};
