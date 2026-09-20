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

// Same as onlyFor, but the "rest" price (what every place/weight/category NOT
// covered by an explicit rule pays) is optional and defaults to 0 - a vendor
// who leaves it blank means "everywhere else ships free".
const restPriceFor = (method, label) => Joi.number().min(0).precision(2).when('method', {
    is: method,
    then: Joi.number().min(0).precision(2).default(0),
    otherwise: Joi.forbidden()
}).label(label);

const priceField = (label) => Joi.number().min(0).precision(2).required().label(label);

const weightBracketSchema = Joi.object({
    minWeight: Joi.number().min(0).required().label('Bracket minimum weight'),
    maxWeight: Joi.number().min(Joi.ref('minWeight')).allow(null).label('Bracket maximum weight')
        .messages({ 'number.min': '{{#label}} cannot be less than the bracket minimum weight.' }),
    price: priceField('Bracket price')
});

const shippingPriceSettingsFields = {
    method: Joi.string().valid(...VALID_SHIPPING_PRICE_METHODS).required().label('Shipping price method'),

    // FIXED
    fixedPrice: onlyFor(SHIPPING_PRICE_METHODS.FIXED, Joi.number().min(0).precision(2)).label('Fixed price'),

    // CATEGORY
    categoryRules: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.array().items(
        Joi.object({
            categoryId: objectId().required().label('Category'),
            price: priceField('Category price')
        })
    ).min(1).max(500)).label('Category rules'),
    categoryChargeMode: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.string().valid(...CATEGORY_CHARGE_MODES)).label('Category charge mode'),
    categoryAggregation: onlyFor(SHIPPING_PRICE_METHODS.CATEGORY, Joi.string().valid(...CATEGORY_AGGREGATIONS)).label('Category aggregation'),
    categoryRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.CATEGORY, 'Category rest price'),

    // COUNTRY
    countryRules: onlyFor(SHIPPING_PRICE_METHODS.COUNTRY, Joi.array().items(
        Joi.object({
            countryId: objectId().required().label('Country'),
            price: priceField('Country price')
        })
    ).min(1).max(500)).label('Country rules'),
    countryRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.COUNTRY, 'Country rest price'),

    // STATE
    stateRules: onlyFor(SHIPPING_PRICE_METHODS.STATE, Joi.array().items(
        Joi.object({
            stateId: objectId().required().label('State'),
            price: priceField('State price')
        })
    ).min(1).max(500)).label('State rules'),
    stateRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.STATE, 'State rest price'),

    // CITY
    cityRules: onlyFor(SHIPPING_PRICE_METHODS.CITY, Joi.array().items(
        Joi.object({
            cityId: objectId().required().label('City'),
            price: priceField('City price')
        })
    ).min(1).max(500)).label('City rules'),
    cityRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.CITY, 'City rest price'),

    // ZIP
    zipRules: onlyFor(SHIPPING_PRICE_METHODS.ZIP, Joi.array().items(
        Joi.object({
            zipCode: Joi.string().trim().min(1).max(20).pattern(/^[0-9A-Za-z\- ]+$/).required().label('Zip code').messages({ 'string.pattern.base': '{{#label}} may contain only letters, numbers, spaces and hyphens.' }),
            price: priceField('Zip price')
        })
    ).min(1).max(1000)).label('Zip rules'),
    zipRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.ZIP, 'Zip rest price'),

    // WEIGHT
    weightUnit: onlyFor(SHIPPING_PRICE_METHODS.WEIGHT, objectId()).label('Weight unit'),
    weightBrackets: onlyFor(SHIPPING_PRICE_METHODS.WEIGHT, Joi.array().items(weightBracketSchema).min(1).max(50)).label('Weight brackets'),
    weightRestPrice: restPriceFor(SHIPPING_PRICE_METHODS.WEIGHT, 'Weight rest price'),

    // FREE_ABOVE
    freeAboveThreshold: onlyFor(SHIPPING_PRICE_METHODS.FREE_ABOVE, Joi.number().greater(0).precision(2)).label('Free-above threshold'),
    freeAboveFallbackPrice: onlyFor(SHIPPING_PRICE_METHODS.FREE_ABOVE, Joi.number().min(0).precision(2)).label('Free-above fallback price')
};

const createShippingPriceSettingsSchema = Joi.object(shippingPriceSettingsFields);

const updateShippingPriceSettingsSchema = Joi.object(shippingPriceSettingsFields);

module.exports = {
    createShippingPriceSettingsSchema,
    updateShippingPriceSettingsSchema
};
