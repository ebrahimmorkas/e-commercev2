const Joi = require('joi');
const { SHIPPING_PRICE_METHODS, VALID_SHIPPING_PRICE_METHODS, CATEGORY_CHARGE_MODES, CATEGORY_AGGREGATIONS } = require('../../constants/shippingPriceConstants');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

// A field only makes sense for one specific method - required when that
// method is active, forbidden (not even allowed to be sent) otherwise, so a
// vendor switching methods can't leave stale rules from a previous method
// sitting in the request.
const onlyFor = (method, schema) => schema.when('method', {
    is: method,
    then: schema.required(),
    otherwise: Joi.forbidden()
});

const weightBracketSchema = Joi.object({
    minWeight: Joi.number().min(0).required().label('Bracket minimum weight'),
    maxWeight: Joi.number().min(0).allow(null).label('Bracket maximum weight'),
    price: Joi.number().min(0).required().label('Bracket price')
});

const shippingPriceSettingsFields = {
    method: Joi.string().valid(...VALID_SHIPPING_PRICE_METHODS).required().label('Shipping price method'),

    // FIXED
    fixedPrice: onlyFor(SHIPPING_PRICE_METHODS.FIXED, Joi.number().min(0)).label('Fixed price'),

    // CATEGORY
    categoryRules: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.array().items(
        Joi.object({
            categoryId: objectId().required().label('Category'),
            price: Joi.number().min(0).required().label('Category price')
        })
    ).min(1)).label('Category rules'),
    categoryChargeMode: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.string().valid(...CATEGORY_CHARGE_MODES)).label('Category charge mode'),
    categoryAggregation: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.string().valid(...CATEGORY_AGGREGATIONS)).label('Category aggregation'),
    categoryRestPrice: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.number().min(0)).label('Category rest price'),

    // COUNTRY
    countryRules: onlyFor(SHIPPING_PRICE_METHODS.COUNTRY, Joi.array().items(
        Joi.object({
            countryId: objectId().required().label('Country'),
            price: Joi.number().min(0).required().label('Country price')
        })
    ).min(1)).label('Country rules'),
    countryRestPrice: onlyFor(SHIPPING_PRICE_METHODS.COUNTRY, Joi.number().min(0)).label('Country rest price'),

    // STATE
    stateRules: onlyFor(SHIPPING_PRICE_METHODS.STATE, Joi.array().items(
        Joi.object({
            stateId: objectId().required().label('State'),
            price: Joi.number().min(0).required().label('State price')
        })
    ).min(1)).label('State rules'),
    stateRestPrice: onlyFor(SHIPPING_PRICE_METHODS.STATE, Joi.number().min(0)).label('State rest price'),

    // CITY
    cityRules: onlyFor(SHIPPING_PRICE_METHODS.CITY, Joi.array().items(
        Joi.object({
            cityId: objectId().required().label('City'),
            price: Joi.number().min(0).required().label('City price')
        })
    ).min(1)).label('City rules'),
    cityRestPrice: onlyFor(SHIPPING_PRICE_METHODS.CITY, Joi.number().min(0)).label('City rest price'),

    // ZIP
    zipRules: onlyFor(SHIPPING_PRICE_METHODS.ZIP, Joi.array().items(
        Joi.object({
            zipCode: Joi.string().trim().min(1).max(20).required().label('Zip code'),
            price: Joi.number().min(0).required().label('Zip price')
        })
    ).min(1)).label('Zip rules'),
    zipRestPrice: onlyFor(SHIPPING_PRICE_METHODS.ZIP, Joi.number().min(0)).label('Zip rest price'),

    // WEIGHT
    weightUnit: onlyFor(SHIPPING_PRICE_METHODS.WEIGHT, objectId()).label('Weight unit'),
    weightBrackets: onlyFor(SHIPPING_PRICE_METHODS.WEIGHT, Joi.array().items(weightBracketSchema).min(1)).label('Weight brackets'),
    weightRestPrice: onlyFor(SHIPPING_PRICE_METHODS.WEIGHT, Joi.number().min(0)).label('Weight rest price'),

    // FREE_ABOVE
    freeAboveThreshold: onlyFor(SHIPPING_PRICE_METHODS.FREE_ABOVE, Joi.number().min(0)).label('Free-above threshold'),
    freeAboveFallbackPrice: onlyFor(SHIPPING_PRICE_METHODS.FREE_ABOVE, Joi.number().min(0)).label('Free-above fallback price')
};

const createShippingPriceSettingsSchema = Joi.object(shippingPriceSettingsFields);

const updateShippingPriceSettingsSchema = Joi.object(shippingPriceSettingsFields);

module.exports = {
    createShippingPriceSettingsSchema,
    updateShippingPriceSettingsSchema
};
