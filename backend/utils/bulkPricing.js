const common = require('./common');

// Bulk pricing is two-level gated like every other feature: the global
// WebsiteMaster switch AND the vendor's CompanyMaster switch. Missing data
// is treated as "off" so a tier can never apply by accident.
const isBulkPricingActive = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        if (!websiteMasterData || !companyMasterData) {
            return false;
        }
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData,
            'isBulkPricingFeatureOn', 'isBulkPricingFeatureOn'
        );
        return featureCheck.isSuccess;
    } catch (err) {
        throw err;
    }
};

// Same product -> variant -> size combination the product responses use
// (productService.combineArrays): a level's tiers are appended to its
// parent's only while its "same as parent" flag is on, otherwise that level
// stands on its own tiers alone.
const resolveEffectiveBulkPricing = (product, variant, size) => {
    try {
        const variantTiers = variant.isBulkPricingSameFromProductBasicDetails
            ? [...(product.bulkPricing || []), ...(variant.variantAdditionalBulkPricing || [])]
            : [...(variant.variantAdditionalBulkPricing || [])];

        return size.isBulkPricingSameFromVariantsDetails
            ? [...variantTiers, ...(size.sizeAdditionalBulkPricing || [])]
            : [...(size.sizeAdditionalBulkPricing || [])];
    } catch (err) {
        throw err;
    }
};

// Picks the tier with the highest minimumQuantity the quantity has reached.
// For tiers 3-5, 6-10, 11-13, 14-20: qty 2 -> none, 5 -> 3-5, 13 -> 11-13,
// and 14 or anything above 20 -> 14-20 (the last tier keeps applying).
const findApplicableTier = (tiers, quantity) => {
    try {
        let applicable = null;
        for (const tier of tiers) {
            if (quantity >= tier.minimumQuantity && (!applicable || tier.minimumQuantity > applicable.minimumQuantity)) {
                applicable = tier;
            }
        }
        return applicable;
    } catch (err) {
        throw err;
    }
};

// Price of one unit of this size at this quantity. originalUnitPrice is the
// size's normal price, returned so the cart can show it struck through when
// a bulk tier brought the unit price down.
const resolveUnitPrice = (product, variant, size, quantity, isBulkPricingOn) => {
    try {
        const originalUnitPrice = size.price;
        if (!isBulkPricingOn) {
            return { unitPrice: originalUnitPrice, originalUnitPrice, isBulkPriceApplied: false };
        }

        const tier = findApplicableTier(resolveEffectiveBulkPricing(product, variant, size), quantity);
        if (!tier || tier.price >= originalUnitPrice) {
            return { unitPrice: originalUnitPrice, originalUnitPrice, isBulkPriceApplied: false };
        }

        return { unitPrice: tier.price, originalUnitPrice, isBulkPriceApplied: true };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isBulkPricingActive,
    resolveEffectiveBulkPricing,
    findApplicableTier,
    resolveUnitPrice
};
