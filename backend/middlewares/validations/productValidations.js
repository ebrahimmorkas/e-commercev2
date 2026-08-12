const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

// Slug: lowercase, hyphen separated, no leading/trailing/double hyphens.
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const bulkPricingTierSchema = Joi.object({
    minQty: Joi.number().integer().min(1).required().label('Minimum quantity'),
    // Open-ended tier: last tier can omit maxQty. If present it must be
    // strictly greater than minQty.
    maxQty: Joi.number().integer().greater(Joi.ref('minQty')).optional()
        .label('Maximum quantity')
        .messages({ 'number.greater': '{{#label}} must be greater than the minimum quantity of the same tier.' }),
    pricePerUnit: Joi.number().positive().required().label('Price per unit')
});

// Enforces the "no overlap/gap, ascending, last tier can be open-ended"
// rule across the whole tier array. Cross-item rules like this can't be
// expressed per-item in Joi, so it's a custom validator on the array.
const bulkPricingArraySchema = Joi.array().items(bulkPricingTierSchema).custom((tiers, helpers) => {
    if (!tiers || tiers.length === 0) return tiers;

    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

    for (let i = 0; i < sorted.length; i++) {
        const tier = sorted[i];
        const next = sorted[i + 1];

        if (next) {
            if (tier.maxQty === undefined || tier.maxQty === null) {
                return helpers.error('bulkPricing.openEndedNotLast');
            }
            if (next.minQty !== tier.maxQty + 1) {
                return helpers.error('bulkPricing.gapOrOverlap');
            }
        }
    }

    return tiers;
}, 'bulk pricing tier continuity').messages({
    'bulkPricing.openEndedNotLast': 'Only the last bulk pricing tier can have an open-ended (missing) maxQty.',
    'bulkPricing.gapOrOverlap': 'Bulk pricing tiers must be contiguous with no gaps or overlaps.'
});

// NOTE: pricePerUnit vs variant.price is a CROSS-OBJECT rule (bulk pricing
// tier lives inside product.bulkPricing / variant.additionalBulkPricing,
// but needs to compare against variant.price which lives elsewhere in the
// payload). Joi can't reach across siblings like that cleanly here, so this
// specific rule (point 7) is enforced in productService.js, not in Joi.

const warrantyLikeSchema = () => Joi.object({
    isAvailable: Joi.boolean().required().label('Warranty availability'),
    days: Joi.number().integer().positive().label('Warranty days').when('isAvailable', {
        is: true,
        then: Joi.required().messages({ 'any.required': 'Warranty days is required when warranty is available.' }),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'Warranty days should not be sent when warranty is not available.' })
    })
}).required().label('Warranty');

const returnExchangeLikeSchema = (label) => Joi.object({
    isAllowed: Joi.boolean().required().label(`${label} availability`),
    days: Joi.number().integer().positive().label(`${label} days`).when('isAllowed', {
        is: true,
        then: Joi.required().messages({ 'any.required': `${label} days is required when ${label.toLowerCase()} is allowed.` }),
        otherwise: Joi.forbidden().messages({ 'any.unknown': `${label} days should not be sent when ${label.toLowerCase()} is not allowed.` })
    })
}).required().label(label);

const shippingSchema = Joi.object({
    type: Joi.string().valid('company settings', 'custom').required().label('Shipping type'),
    shippingPrice: Joi.number().positive().label('Shipping price').when('type', {
        is: 'custom',
        then: Joi.required().messages({ 'any.required': 'Shipping price is required when shipping type is custom.' }),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'Shipping price should not be sent when shipping type is "company settings".' })
    })
}).required().label('Shipping');

// additionalDescription / description are Map<String, String> on the
// model. FIX (point 9): the value schema previously allowed an empty
// string (`.allow('')`), which meant a vendor could submit a key with an
// effectively blank value and it would pass. Both key and value are now
// required to be non-empty once a description entry is started.
const stringMapSchema = Joi.object().pattern(
    Joi.string().trim().min(1),
    Joi.string().trim().min(1).messages({
        'string.empty': 'Every description value must be filled in if its key is present.',
        'string.min': 'Every description value must be filled in if its key is present.'
    })
).messages({
    'object.base': 'Description must be a set of key-value pairs.'
});

const baseVariantFields = {
    isDefault: Joi.boolean().default(false).label('Default flag'),
    color: Joi.string().trim().min(1).max(40).required().label('Color'),
    sizeId: objectId().required().label('Size'),
    unitId: objectId().required().label('Unit'),
    displayName: Joi.string().trim().max(150).allow('', null).label('Display name'),
    price: Joi.number().positive().required().label('Price'),
    // FIX (point 3 & 4): cancelledPrice stays fully optional - vendor
    // decides whether to set it at all. When it IS set, price must always
    // be the smaller of the two, i.e. cancelledPrice > price.
    cancelledPrice: Joi.number().positive().greater(Joi.ref('price')).optional().allow(null)
        .label('Cancelled price')
        .messages({ 'number.greater': 'Cancelled price must be greater than the price.' }),
    stock: Joi.number().integer().min(0).required().label('Stock'),
    isDescriptionSame: Joi.boolean().default(true).label('Reuse description'),
    isDisclaimerSame: Joi.boolean().default(true).label('Reuse disclaimer'),
    isBulkPricingSame: Joi.boolean().default(true).label('Reuse bulk pricing'),
    additionalDisclaimer: Joi.string().allow('', null).label('Additional disclaimer'),
    additionalDescription: stringMapSchema.label('Additional description'),
    additionalBulkPricing: bulkPricingArraySchema.label('Additional bulk pricing'),
    warranty: warrantyLikeSchema(),
    return: returnExchangeLikeSchema('Return'),
    exchange: returnExchangeLikeSchema('Exchange'),
    shipping: shippingSchema,
    precedence: Joi.number().integer().default(0).label('Precedence'),
    weight: Joi.string().trim().allow('', null).label('Weight'),
    sku: Joi.string().trim().min(1).required().label('SKU'),
    barcode: Joi.string().trim().allow('', null).label('Barcode'),
    variantCode: Joi.string().trim().min(1).required().label('Variant code'),
    excludeCountries: Joi.array().items(objectId()).label('Excluded countries'),
    excludeStates: Joi.array().items(objectId()).label('Excluded states'),
    excludeCities: Joi.array().items(objectId()).label('Excluded cities'),
    excludeZipCodes: Joi.array().items(Joi.string().trim()).label('Excluded zip codes'),
    brand: Joi.string().trim().allow('', null).label('Brand')
    // image / additionalImages intentionally omitted - handled in a later pass.
};

const createVariantSchema = Joi.object({ ...baseVariantFields });

// On update, an existing variant is matched by _id (kept/updated); a new
// variant is submitted without _id (created). Any existing variant whose
// _id is missing from the submitted array is treated as removed - see
// productService.updateProduct for the default-variant guard around this.
const updateVariantSchema = Joi.object({
    _id: objectId().optional().label('Variant id'),
    ...baseVariantFields
});

const createProductSchema = Joi.object({
    name: Joi.string().trim().min(2).max(200).required().label('Product name'),
    description: stringMapSchema.label('Description'),
    colors: Joi.array().items(Joi.string().trim().min(1)).min(1).unique().required().label('Colors'),
    mainCategory: objectId().allow(null).label('Main category'),
    subCategory: objectId().allow(null).label('Sub category'),
    disclaimer: Joi.string().allow('', null).label('Disclaimer'),
    brand: Joi.string().trim().allow('', null).label('Brand'),
    searchKeywords: Joi.array().items(Joi.string().trim().min(1)).unique().label('Search keywords'),
    recommendedProducts: Joi.array().items(objectId()).unique().label('Recommended products'),
    taxIds: Joi.array().items(objectId()).unique().label('Taxes'),
    precedence: Joi.number().integer().default(0).label('Precedence'),
    // Optional - auto-generated from `name` in the service when omitted.
    slug: Joi.string().trim().lowercase().pattern(slugPattern).label('Slug').messages({
        'string.pattern.base': 'Slug must be lowercase, alphanumeric, hyphen-separated (e.g. "blue-cotton-shirt").'
    }),
    productCode: Joi.string().trim().min(1).required().label('Product code'),
    bulkPricing: bulkPricingArraySchema.label('Bulk pricing'),
    variants: Joi.array().items(createVariantSchema).min(1).required().label('Variants')
});

const updateProductSchema = Joi.object({
    name: Joi.string().trim().min(2).max(200).label('Product name'),
    description: stringMapSchema.label('Description'),
    colors: Joi.array().items(Joi.string().trim().min(1)).min(1).unique().label('Colors'),
    mainCategory: objectId().allow(null).label('Main category'),
    subCategory: objectId().allow(null).label('Sub category'),
    disclaimer: Joi.string().allow('', null).label('Disclaimer'),
    brand: Joi.string().trim().allow('', null).label('Brand'),
    searchKeywords: Joi.array().items(Joi.string().trim().min(1)).unique().label('Search keywords'),
    recommendedProducts: Joi.array().items(objectId()).unique().label('Recommended products'),
    taxIds: Joi.array().items(objectId()).unique().label('Taxes'),
    precedence: Joi.number().integer().label('Precedence'),
    slug: Joi.string().trim().lowercase().pattern(slugPattern).label('Slug').messages({
        'string.pattern.base': 'Slug must be lowercase, alphanumeric, hyphen-separated (e.g. "blue-cotton-shirt").'
    }),
    productCode: Joi.string().trim().min(1).label('Product code'),
    bulkPricing: bulkPricingArraySchema.label('Bulk pricing'),
    variants: Joi.array().items(updateVariantSchema).min(1).label('Variants')
}).min(1);

// productId in the URL is the encrypted id produced by common.encodeId, so
// it's validated as a non-empty string here; common.decodeId + ObjectId
// validation happens in the service once it's decrypted.
const productIdParamSchema = Joi.object({
    productId: Joi.string().trim().min(1).required().label('Product id')
});

const listQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(100).default(20).label('Limit'),
    search: Joi.string().trim().allow('', null).label('Search'),
    mainCategory: objectId().label('Main category'),
    subCategory: objectId().label('Sub category')
});

module.exports = {
    createProductSchema,
    updateProductSchema,
    productIdParamSchema,
    listQuerySchema
};