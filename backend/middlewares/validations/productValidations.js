const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

// --- description entry (matches descriptionEntrySchema in Product.js) -------
// Reused for product description, variantAdditionalDescription, and
// sizeAdditionalDescription - same shape, same duplicate-key rule.
const descriptionEntrySchema = Joi.object({
    key: Joi.string().trim().min(1).required().label('Key'),
    value: Joi.string().trim().allow('', null).label('Value')
});

const descriptionArraySchema = Joi.array()
    .items(descriptionEntrySchema)
    .unique((a, b) => a.key.trim().toLowerCase() === b.key.trim().toLowerCase())
    .messages({ 'array.unique': 'Description keys must be unique.' })
    .label('Description');

// --- Bulk pricing (matches bulkPricingSchema in Product.js) -----------------
const bulkPricingItemSchema = Joi.object({
    minimumQuantity: Joi.number().min(1).required().label('Minimum quantity'),
    maximumQuantity: Joi.number().min(1).required()
        .greater(Joi.ref('minimumQuantity'))
        .label('Maximum quantity')
        .messages({ 'number.greater': '{{#label}} must be greater than minimum quantity.' }),
    price: Joi.number().min(0).required().label('Price')
});

// --- Measurement value (matches measurementValueSchema in Product.js) -------
// Cross-referenced against the size's SizeMaster.measurements in
// productService.js (measurementLabel must exist on that master, unit must
// be inside that measurement's allowedUnits) - Joi only enforces shape here.
const measurementValueSchema = Joi.object({
    measurementId: objectId().required().label('Measurement'),
    unit: objectId().required().label('Unit'),
    value: Joi.number().required().label('Value')
});

// --- Weight (matches weightSchema in Product.js) ------------------------------
const weightSchema = Joi.object({
    value: Joi.number().min(0).required().label('Weight value'),
    unit: objectId().required().label('Weight unit')
});

// --- Policy (matches policySchema in Product.js - warranty/return/exchange) --
// duration/durationType are required only when isAvailable is true; when
// false they're ignored/optional so the vendor doesn't have to send nulls.
const policySchema = Joi.object({
    isAvailable: Joi.boolean().default(false),
    duration: Joi.number().min(0).when('isAvailable', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
    }).label('Duration'),
    durationType: Joi.string().valid('DAYS', 'MONTHS', 'YEARS').when('isAvailable', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
    }).label('Duration type')
});

// --- Shipping (matches shippingSchema in Product.js) --------------------------
// value is required and must be a plain number whenever type is CUSTOM
// (vendor-entered custom shipping cost); forbidden when COMPANY_SETTINGS
// (shipping cost comes from company-wide config instead).
const shippingSchema = Joi.object({
    type: Joi.string().valid('CUSTOM', 'COMPANY_SETTINGS').required().label('Shipping type'),
    value: Joi.number().when('type', {
        is: 'CUSTOM',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }).label('Shipping value')
});

// --- Size (matches sizeSchema in Product.js) ----------------------------------
// Fully specified. sizeId is required and cross-referenced against
// SizeMaster + CompanyMaster.allowedSizes in productService.js. values/
// labelValue are mutually exclusive based on sizeType, matching the
// Mongoose required-function behavior. image/additionalImages are NEVER
// part of this schema - they arrive as multipart files, matched by array
// position (see productRoutes.js).
const sizeSchema = Joi.object({
    isDefaultSize: Joi.boolean().default(false),
    sizeType: Joi.string().valid('MEASURABLE', 'LABEL').required().label('Size type'),
    sizeName: Joi.string().trim().min(1).required().label('Size name'),
    sizeAdditionalDisclaimer: Joi.string().trim().allow('', null).label('Size additional disclaimer'),
    sizeAdditionalDescription: descriptionArraySchema.label('Size additional description'),
    sizeAdditionalBulkPricing: Joi.array().items(bulkPricingItemSchema).label('Size additional bulk pricing'),
    warranty: policySchema.label('Warranty'),
    return: policySchema.label('Return'),
    exchange: policySchema.label('Exchange'),
    shipping: shippingSchema.allow(null).label('Shipping'),
    isDescriptionSameFromVariantsDetails: Joi.boolean().default(true),
    isDisclaimerSameFromVariantsDetails: Joi.boolean().default(true),
    isBulkPricingSameFromVariantsDetails: Joi.boolean().default(true),
    precedence: Joi.number().min(1).label('Precedence'),
    excludeCountries: Joi.array().items(objectId()).label('Exclude countries'),
    excludeStates: Joi.array().items(objectId()).label('Exclude states'),
    excludeCities: Joi.array().items(objectId()).label('Exclude cities'),
    excludeZipCodes: Joi.array().items(Joi.string().trim()).label('Exclude zip codes'),
    brand: Joi.string().trim().allow('', null).label('Brand'),
    sizeId: objectId().required().label('Size master reference'),
    values: Joi.array().items(measurementValueSchema)
        .unique((a, b) => a.measurementId === b.measurementId)
        .messages({ 'array.unique': 'Duplicate measurement in values.' })
        .label('Values')
        .when('sizeType', {
            is: 'MEASURABLE',
            then: Joi.array().min(1).required(),
            otherwise: Joi.forbidden()
        }),
    labelValue: Joi.string().trim().label('Label value').when('sizeType', {
        is: 'LABEL',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }),
    price: Joi.number().min(0).required().label('Price'),
    cancelledPrice: Joi.number().min(0).allow(null).label('Cancelled price'),
    stock: Joi.number().min(0).default(0).label('Stock'),
    weight: weightSchema.allow(null).label('Weight'),
    sku: Joi.string().trim().min(1).required().label('SKU'),
    barcode: Joi.string().trim().allow('', null).label('Barcode'),
    sizeCode: Joi.string().trim().label('Size code')
});

// Cross-item rules within one variant's sizes array: at most one default
// size, and no two sizes may resolve to the exact same sizeId + value
// (same sizeId with a DIFFERENT label/measurement value is fine and
// expected - e.g. shoe sizes 7/8/9 all referencing one SizeMaster doc).
const validateSizesArray = (sizesArray, helpers) => {
    const seenKeys = new Set();
    let defaultCount = 0;

    for (const size of sizesArray) {
        let key;
        if (size.sizeType === 'LABEL') {
            key = `${size.sizeId}::LABEL::${(size.labelValue || '').trim().toLowerCase()}`;
        } else {
            const sortedValues = [...(size.values || [])]
                .map(v => `${v.measurementId}:${v.unit}:${v.value}`)
                .sort()
                .join('|');
            key = `${size.sizeId}::MEASURABLE::${sortedValues}`;
        }

        if (seenKeys.has(key)) {
            return helpers.error('sizes.duplicate');
        }
        seenKeys.add(key);

        if (size.isDefaultSize) {
            defaultCount++;
        }
    }

    if (defaultCount > 1) {
        return helpers.error('sizes.multipleDefaults');
    }

    return sizesArray;
};

// --- Variant (matches variantSchema in Product.js) ----------------------------
// sizes is now fully required - every variant must have at least one size.
const variantSchema = Joi.object({
    isDefaultVariant: Joi.boolean().default(false),
    color: Joi.string().trim().allow(null).label('Color'),
    displayName: Joi.string().trim().allow(null).label('Display name'),
    sizes: Joi.array().items(sizeSchema).min(1).required().custom(validateSizesArray)
        .messages({
            'sizes.duplicate': 'Duplicate size detected within this variant - the same size and value combination was added more than once.',
            'sizes.multipleDefaults': 'Only one size can be marked as the default size within a variant.'
        })
        .label('Sizes'),
    variantAdditionalDisclaimer: Joi.string().trim().allow('', null).label('Variant additional disclaimer'),
    variantAdditionalDescription: descriptionArraySchema.label('Variant additional description'),
    variantAdditionalBulkPricing: Joi.array().items(bulkPricingItemSchema).label('Variant additional bulk pricing'),
    isDescriptionSameFromProductBasicDetails: Joi.boolean().default(true),
    isDisclaimerSameFromProductBasicDetails: Joi.boolean().default(true),
    isBulkPricingSameFromProductBasicDetails: Joi.boolean().default(true),
    variantCode: Joi.string().trim().label('Variant code')
});

// Cross-item rules that can't be expressed per-item: colors must be
// distinct across a product's variants (case-insensitive), and at most one
// variant may be marked as the default.
const validateVariantsArray = (variantsArray, helpers) => {
    const seenColors = new Set();
    let defaultCount = 0;

    for (const variant of variantsArray) {
        if (variant.color) {
            const normalizedColor = variant.color.trim().toLowerCase();
            if (seenColors.has(normalizedColor)) {
                return helpers.error('variants.duplicateColor', { color: variant.color });
            }
            seenColors.add(normalizedColor);
        }
        if (variant.isDefaultVariant) {
            defaultCount++;
        }
    }

    if (defaultCount > 1) {
        return helpers.error('variants.multipleDefaults');
    }

    return variantsArray;
};

// --- Product (pass 2 + 3 + 4: basic details, variants, sizes) -----------------
// mainCategory/subCategory are intentionally optional here - whether they're
// even allowed at all (isCategoryFeatureOn) and whether nesting is allowed
// (isCategoryNestingAllowed) depend on vendor-specific CompanyMaster data,
// which Joi has no access to - that's enforced in productService.js instead.
// productCode/variantCode/sizeCode are optional here for the same reason:
// whether they're required from the vendor or server-generated depends on
// CompanySettings (isProductCodeAutoGenerated / isVariantCodeAutoGenerated /
// isSizeCodeAutoGenerated), also enforced in the service.
// variants is now required with at least one entry - every product must
// have at least one variant, and every variant must have at least one size.
const createProductSchema = Joi.object({
    name: Joi.string().trim().min(1).required().label('Product name'),
    description: descriptionArraySchema,
    disclaimer: Joi.string().trim().allow('', null).label('Disclaimer'),
    colors: Joi.array().items(Joi.string().trim()).label('Colors'),
    mainCategory: objectId().allow(null).label('Main category'),
    subCategory: objectId().allow(null).label('Sub category'),
    searchKeywords: Joi.array().items(Joi.string().trim()).label('Search keywords'),
    recommendedProducts: Joi.array().items(objectId()).label('Recommended products'),
    taxIds: Joi.array().items(objectId()).label('Taxes'),
    precedence: Joi.number().min(1).label('Precedence'),
    productCode: Joi.string().trim().label('Product code'),
    bulkPricing: Joi.array().items(bulkPricingItemSchema).label('Bulk pricing'),
    variants: Joi.array().items(variantSchema).min(1).required().custom(validateVariantsArray)
        .messages({
            'variants.duplicateColor': 'Color "{{#color}}" is used in more than one variant - colors must be distinct across variants.',
            'variants.multipleDefaults': 'Only one variant can be marked as the default variant.'
        })
        .label('Variants')
})
    .with('subCategory', 'mainCategory'); // can't send a sub category without also naming the main category it falls under

module.exports = {
    createProductSchema
};