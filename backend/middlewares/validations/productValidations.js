const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

// --- description entry (matches descriptionEntrySchema in Product.js) -------
// key and value are both required whenever an entry is present - there's no
// scenario where one is filled without the other, so this is enforced as a
// plain pairing rather than a conditional XOR rule.
const descriptionEntrySchema = Joi.object({
    key: Joi.string().trim().min(1).required().label('Key'),
    value: Joi.string().trim().min(1).required().label('Value')
});

const descriptionArraySchema = Joi.array()
    .items(descriptionEntrySchema)
    .unique((a, b) => a.key.trim().toLowerCase() === b.key.trim().toLowerCase())
    .messages({ 'array.unique': 'Description keys must be unique.' })
    .label('Description');
// Description itself stays fully optional (no .required()/.min(1) here) -
// a product/variant/size can have zero description entries.

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
const shippingSchema = Joi.object({
    type: Joi.string().valid('CUSTOM', 'COMPANY_SETTINGS').required().label('Shipping type'),
    value: Joi.number().when('type', {
        is: 'CUSTOM',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }).label('Shipping value')
});

// --- Size (matches sizeSchema in Product.js) ----------------------------------
// cancelledPrice remains optional (point 7); when present, price must be
// strictly less than it (point 1) - enforced via the object-level .custom()
// below since it's a cross-field rule Joi.number() alone can't express
// cleanly against a sibling that may be null/absent.
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
})
    .custom((size, helpers) => {
        if (size.cancelledPrice !== null && size.cancelledPrice !== undefined && size.price >= size.cancelledPrice) {
            return helpers.error('size.priceNotLessThanCancelledPrice');
        }
        return size;
    })
    .messages({ 'size.priceNotLessThanCancelledPrice': 'Price must be less than cancelled price.' });

// Cross-item rules within one variant's sizes array: at most one default
// size, and no two sizes may resolve to the exact same sizeId + value.
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
// color stays optional (not every product line needs color-based variants);
// when present, it's checked against the product's own `colors` array by
// the whole-schema validateProductLevelRules custom below (point 2).
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

// Whole-product-level rule (point 2): every variant.color that is set must
// be an EXACT match (case-sensitive - frontend supplies a dropdown built
// from product.colors, not free text) to one of the entries in the
// product's own `colors` array. Needs access to both sibling fields at
// once, which is why this lives as a top-level .custom() on
// createProductSchema rather than inside variantSchema/validateVariantsArray.
const validateColorsAgainstVariants = (product, helpers) => {
    const productColors = new Set(product.colors || []);

    for (const variant of (product.variants || [])) {
        if (variant.color && !productColors.has(variant.color)) {
            return helpers.error('product.invalidVariantColor', { color: variant.color });
        }
    }

    return product;
};

// --- Product (pass 2 + 3 + 4, plus cross-cutting validations) -----------------
// colors is now required with at least one entry (point 2) - the frontend
// gates variant creation on this being filled first, so Joi enforces the
// same rule server-side.
const createProductSchema = Joi.object({
    name: Joi.string().trim().min(1).required().label('Product name'),
    description: descriptionArraySchema,
    disclaimer: Joi.string().trim().allow('', null).label('Disclaimer'),
    colors: Joi.array().items(Joi.string().trim()).min(1).required().label('Colors'),
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
    .with('subCategory', 'mainCategory') // can't send a sub category without also naming the main category it falls under
    .custom(validateColorsAgainstVariants)
    .messages({
        'product.invalidVariantColor': 'Variant color "{{#color}}" is not one of the product\'s selected colors.'
    });

const idParamSchema = Joi.object({
    id: objectId().required().label('Product ID')
});

module.exports = {
    createProductSchema,
    idParamSchema
};