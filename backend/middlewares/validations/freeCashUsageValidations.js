const Joi = require('joi');
const {
    CUSTOMER_STATUS_FILTERS,
    FREE_CASH_USAGE_SORTS,
    FREE_CASH_USAGE_MAX_PAGE_SIZE,
    MAX_FREE_CASH_FILTER_AMOUNT
} = require('../../constants/freeCashUsageConstants');

// Customer ids are common.encodeId-encoded (see formatCustomerForResponse in
// freeCashUsageController), never a raw hex ObjectId - so this is an
// opaque-string check: only the characters an encoded id can contain, and a
// sane length. Decoded (and checked to be a real ObjectId) in the controller.
const encodedId = () => Joi.string().trim().min(1).max(200).pattern(/^[A-Za-z0-9_-]+$/).messages({
    'any.required': '{{#label}} is required.',
    'string.base': '{{#label}} must be a valid id.',
    'string.empty': '{{#label}} is required.',
    'string.min': '{{#label}} must be a valid id.',
    'string.max': '{{#label}} must be a valid id.',
    'string.pattern.base': '{{#label}} must be a valid id.'
});

// One end of the "active Free Cash" range: a money amount in the store
// currency - 0 or more, at most 2 decimals. Blank = that end is open.
const amount = (label) => Joi.number().min(0).max(MAX_FREE_CASH_FILTER_AMOUNT)
    .empty(Joi.valid('', null))
    // Rejected rather than silently rounded - 10.999 is a typo, not 11.
    .custom((value, helpers) => (Math.abs(Math.round(value * 100) - value * 100) < 1e-6
        ? value
        : helpers.error('number.precision', { limit: 2 })))
    .messages({
        'number.base': '{{#label}} must be a number.',
        'number.min': '{{#label}} cannot be negative.',
        'number.max': '{{#label}} is too large.',
        'number.precision': '{{#label}} can have at most 2 decimal places.',
        'number.unsafe': '{{#label}} is too large.',
        'number.infinity': '{{#label}} must be a real number.'
    })
    .label(label);

const customersQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).max(100000).default(1).messages({
        'number.base': '{{#label}} must be a number.',
        'number.integer': '{{#label}} must be a whole number.',
        'number.min': '{{#label}} must be at least {{#limit}}.',
        'number.max': '{{#label}} is too large.'
    }).label('Page'),
    limit: Joi.number().integer().min(1).max(FREE_CASH_USAGE_MAX_PAGE_SIZE).messages({
        'number.base': '{{#label}} must be a number.',
        'number.integer': '{{#label}} must be a whole number.',
        'number.min': '{{#label}} must be at least {{#limit}}.',
        'number.max': '{{#label}} cannot be more than {{#limit}}.'
    }).label('Limit'),
    // Regex characters are escaped in the service - only the length and
    // control characters are restricted here.
    search: Joi.string().trim().max(100).pattern(/^[^\u0000-\u001F\u007F]*$/).allow('').messages({
        'string.max': '{{#label}} cannot be longer than {{#limit}} characters.',
        'string.pattern.base': '{{#label}} contains characters that are not allowed.'
    }).label('Search'),
    minAmount: amount('Minimum active Free Cash'),
    maxAmount: amount('Maximum active Free Cash'),
    customerStatus: Joi.string().trim().uppercase().valid(...CUSTOMER_STATUS_FILTERS).default('ALL').messages({
        'any.only': '{{#label}} must be one of ALL, A (active) or I (inactive).'
    }).label('Customer status'),
    sort: Joi.string().trim().uppercase().valid(...FREE_CASH_USAGE_SORTS).default('NAME').messages({
        'any.only': '{{#label}} must be one of NAME, ACTIVE_HIGH_TO_LOW or ACTIVE_LOW_TO_HIGH.'
    }).label('Sort')
}).custom((value, helpers) => {
    // "From" can't be above "to" - the range would match nobody.
    if (value.minAmount !== undefined && value.maxAmount !== undefined && value.minAmount > value.maxAmount) {
        return helpers.message('Minimum active Free Cash cannot be more than the maximum.');
    }
    return value;
});

const customerIdParamSchema = Joi.object({
    userId: encodedId().required().label('Customer')
});

module.exports = {
    customersQuerySchema,
    customerIdParamSchema
};
