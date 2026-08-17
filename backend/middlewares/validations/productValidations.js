const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

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

const sizeSchema = Joi.object({
    isDefaultSize: Joi.boolean().default(false),
    sizeType: Joi.string().valid('MEASURABLE', 'LABEL').required().label('Size type'),
    sizeName: Joi.string().trim().label('Size name').when('sizeType', {
        is: 'MEASURABLE',
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
    }),
    values: Joi.array().items(Joi.number()).label('Values').when('sizeType', {
        is: 'MEASURABLE',
        then: Joi.array().min(1).required(),
        otherwise: Joi.forbidden()
    }),
    sizeId: objectId().allow(null).label('Size master reference'),
    price: Joi.number().min(0).required().label('Price'),
    cancelledPrice: Joi.number().min(0).allow(null).label('Cancelled price'),
    stock: Joi.number().min(0).default(0).label('Stock'),
    weight: Joi.string().trim().allow('', null).label('Weight'),
    sku: Joi.string().trim().allow('', null).label('SKU'),
    barcode: Joi.string().trim().allow('', null).label('Barcode'),
    sizeCode: Joi.string().trim().allow('', null).label('Size code'),
    precedence: Joi.number().min(1).label('Precedence')
}).unknown(true); // TEMP - drop once every sizeSchema field above has real validation

const variantSchema = Joi.object({
    isDefaultVariant: Joi.boolean().default(false),
    color: Joi.string().trim().allow(null).label('Color'),
    displayName: Joi.string().trim().allow(null).label('Display name'),
    sizes: Joi.array().items(sizeSchema).default([]).label('Sizes'), // TEMP - .min(1).required() reinstated in pass 4
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
    variants: Joi.array().items(variantSchema).custom(validateVariantsArray)
        .messages({
            'variants.duplicateColor': 'Color "{{#color}}" is used in more than one variant - colors must be distinct across variants.',
            'variants.multipleDefaults': 'Only one variant can be marked as the default variant.'
        })
        .label('Variants')
    // Still fully optional at creation (variants: [] is valid) - the "every
    // product needs at least one variant" rule is enforced only when the
    // vendor finalizes/submits the product, not at this create step.
})
    .with('subCategory', 'mainCategory') // can't send a sub category without also naming the main category it falls under
    .unknown(true); // TEMP - remove once sizeSchema (pass 4) is fully validated

module.exports = {
    createProductSchema
};