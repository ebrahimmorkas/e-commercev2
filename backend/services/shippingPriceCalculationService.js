const common = require('../utils/common');
const weightMasterService = require('./weightMasterService');
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

const calculateLocationAmount = (rules, idField, restPrice, resolvedId) => {
    try {
        if (!resolvedId) return restPrice || 0;
        const match = rules.find((r) => r[idField].toString() === resolvedId.toString());
        return match ? match.price : (restPrice || 0);
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
| Computes the shipping-price contribution of a cart's COMPANY_SETTINGS-priced
| line items (per the vendor's single active ShippingPriceSettings.method),
| plus the flat sum of any CUSTOM-priced line items, per unit x quantity.
| Returns 0 gracefully (never errors) whenever the feature is off or
| unconfigured, so a missing/disabled shipping-price setup never blocks
| checkout.
|
| lineItems: [{ shippingType: 'CUSTOM'|'COMPANY_SETTINGS'|null, shippingValue,
|               mainCategoryId, subCategoryId, weight: {value, unit}|null, quantity }]
*/
const calculateShippingPriceAmount = async ({ lineItems, subtotal, shippingPriceSettings, locationContext, companyMasterData, websiteMasterData }) => {
    try {
        const customItems = lineItems.filter((i) => i.shippingType === 'CUSTOM');
        const companyItems = lineItems.filter((i) => i.shippingType !== 'CUSTOM');

        const customAmount = customItems.reduce((sum, i) => sum + (i.shippingValue || 0) * i.quantity, 0);

        const featureOn = !!(websiteMasterData?.isShippingPriceFeatureOn && companyMasterData?.isShippingPriceFeatureOn);

        if (!featureOn || !shippingPriceSettings || companyItems.length === 0) {
            return common.returnResult(true, 200, 'Shipping price calculated successfully', {
                shippingAmount: round2(customAmount),
                breakdown: { customAmount: round2(customAmount), companyAmount: 0, method: shippingPriceSettings?.method || null }
            });
        }

        let companyAmount = 0;
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
                companyAmount = calculateLocationAmount(shippingPriceSettings.countryRules, 'countryId', shippingPriceSettings.countryRestPrice, locationContext?.countryId);
                break;
            case SHIPPING_PRICE_METHODS.STATE:
                companyAmount = calculateLocationAmount(shippingPriceSettings.stateRules, 'stateId', shippingPriceSettings.stateRestPrice, locationContext?.stateId);
                break;
            case SHIPPING_PRICE_METHODS.CITY:
                companyAmount = calculateLocationAmount(shippingPriceSettings.cityRules, 'cityId', shippingPriceSettings.cityRestPrice, locationContext?.cityId);
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
            case SHIPPING_PRICE_METHODS.FREE_ABOVE:
                companyAmount = subtotal >= shippingPriceSettings.freeAboveThreshold ? 0 : (shippingPriceSettings.freeAboveFallbackPrice || 0);
                break;
            default:
                companyAmount = 0;
        }

        const shippingAmount = round2(customAmount + companyAmount);

        return common.returnResult(true, 200, 'Shipping price calculated successfully', {
            shippingAmount,
            breakdown: { customAmount: round2(customAmount), companyAmount: round2(companyAmount), method: shippingPriceSettings.method }
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    calculateShippingPriceAmount
};
