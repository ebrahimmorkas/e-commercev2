const Joi = require('joi');
const {
    VALID_STOCK_OPERATIONS,
    VALID_STOCK_FILTERS,
    VALID_INVENTORY_LOG_TYPES,
    MAX_ADJUST_QUANTITY,
    MAX_REMARK_LENGTH,
    MAX_BULK_ADJUST_ITEMS,
    INVENTORY_MAX_PAGE_SIZE
} = require('../../constants/inventoryConstants');

// Product / variant / size ids are common.encodeId-encoded (see
// formatInventoryItemForResponse in inventoryController), never a raw hex
// ObjectId - so this is an opaque-string check: only the characters an
// encoded id can contain, and a sane length. Decoded (and checked to be a
// real ObjectId) in the controller.
const encodedId = () => Joi.string().trim().min(1).max(200).pattern(/^[A-Za-z0-9_-]+$/).messages({
    'any.required': '{{#label}} is required.',
    'string.base': '{{#label}} must be a valid id.',
    'string.empty': '{{#label}} is required.',
    'string.min': '{{#label}} must be a valid id.',
    'string.max': '{{#label}} must be a valid id.',
    'string.pattern.base': '{{#label}} must be a valid id.'
});

const SORT_VALUES = ['NAME', 'STOCK_LOW_TO_HIGH', 'STOCK_HIGH_TO_LOW'];

const page = () => Joi.number().integer().min(1).max(100000).default(1).messages({
    'number.base': '{{#label}} must be a number.',
    'number.integer': '{{#label}} must be a whole number.',
    'number.min': '{{#label}} must be at least {{#limit}}.',
    'number.max': '{{#label}} is too large.',
    'number.unsafe': '{{#label}} is too large.'
}).label('Page');

const limit = () => Joi.number().integer().min(1).max(INVENTORY_MAX_PAGE_SIZE).messages({
    'number.base': '{{#label}} must be a number.',
    'number.integer': '{{#label}} must be a whole number.',
    'number.min': '{{#label}} must be at least {{#limit}}.',
    'number.max': '{{#label}} cannot be more than {{#limit}}.',
    'number.unsafe': '{{#label}} is too large.'
}).label('Limit');

// Free-text search. Regex characters are escaped in the service, so anything
// printable is fine here - only the length and control characters are restricted.
const search = () => Joi.string().trim().max(100).pattern(/^[^\u0000-\u001F\u007F]*$/).allow('').messages({
    'string.max': '{{#label}} cannot be longer than {{#limit}} characters.',
    'string.pattern.base': '{{#label}} contains characters that are not allowed.'
}).label('Search');

// How many to add / take off: a whole number, at least 1. A decimal (2.5),
// zero, a negative number or text is rejected rather than rounded - stock is
// counted in whole units (Product size stock is .integer() too). `convert`
// stays on so "5" from a text field is accepted, but "5abc" / "" are not.
const quantity = () => Joi.number().integer().min(1).max(MAX_ADJUST_QUANTITY).required().messages({
    'any.required': '{{#label}} is required.',
    'number.base': '{{#label}} must be a number.',
    'number.integer': '{{#label}} must be a whole number (no decimals).',
    'number.min': '{{#label}} must be at least {{#limit}}.',
    'number.max': '{{#label}} cannot be more than {{#limit}} at a time.',
    'number.unsafe': '{{#label}} is too large.',
    'number.infinity': '{{#label}} must be a real number.'
}).label('Quantity');

const operation = () => Joi.string().trim().uppercase().valid(...VALID_STOCK_OPERATIONS).required().messages({
    'any.required': 'Choose whether to increase or deduct the stock.',
    'any.only': '{{#label}} must be either INCREASE or DEDUCT.',
    'string.empty': 'Choose whether to increase or deduct the stock.'
}).label('Operation');

// Optional note. A blank one is stored as null; control characters (other
// than a line break / tab) are rejected.
const remark = () => Joi.string().trim().max(MAX_REMARK_LENGTH)
    .pattern(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/)
    .allow('', null)
    .custom((value) => (value === '' ? null : value))
    .messages({
        'string.base': '{{#label}} must be text.',
        'string.max': '{{#label}} cannot be longer than {{#limit}} characters.',
        'string.pattern.base': '{{#label}} contains characters that are not allowed.'
    })
    .label('Remark');

// One size, addressed by its full path (product > variant > size).
const sizeReference = {
    productId: encodedId().required().label('Product'),
    variantId: encodedId().required().label('Variant'),
    sizeId: encodedId().required().label('Size')
};

const inventoryListQuerySchema = Joi.object({
    page: page(),
    limit: limit(),
    search: search(),
    stockFilter: Joi.string().trim().uppercase().valid(...VALID_STOCK_FILTERS).default('ALL').messages({
        'any.only': '{{#label}} must be one of ALL, IN_STOCK, LOW_STOCK or OUT_OF_STOCK.'
    }).label('Stock level'),
    sort: Joi.string().trim().uppercase().valid(...SORT_VALUES).default('NAME').messages({
        'any.only': '{{#label}} must be one of NAME, STOCK_LOW_TO_HIGH or STOCK_HIGH_TO_LOW.'
    }).label('Sort')
});

const adjustStockSchema = Joi.object({
    ...sizeReference,
    operation: operation(),
    quantity: quantity(),
    remark: remark()
});

// The same quantity is added to / taken off every selected size. A size may
// only be listed once - listing it twice would adjust it twice.
const bulkAdjustStockSchema = Joi.object({
    items: Joi.array()
        .items(Joi.object(sizeReference).label('Item'))
        .min(1)
        .max(MAX_BULK_ADJUST_ITEMS)
        .unique('sizeId')
        .required()
        .messages({
            'any.required': 'Select at least one item.',
            'array.base': '{{#label}} must be a list.',
            'array.min': 'Select at least one item.',
            'array.max': 'You can adjust at most {{#limit}} items at a time.',
            'array.unique': 'The same item is selected more than once.'
        })
        .label('Items'),
    operation: operation(),
    quantity: quantity(),
    remark: remark()
});

const inventoryLogQuerySchema = Joi.object({
    page: page(),
    limit: limit(),
    search: search(),
    // History of one size only (the row's "History" action).
    sizeId: encodedId().label('Size'),
    type: Joi.string().trim().uppercase().valid(...VALID_INVENTORY_LOG_TYPES).messages({
        'any.only': '{{#label}} must be one of INITIAL, INCREASE or DEDUCT.'
    }).label('Type')
});

module.exports = {
    inventoryListQuerySchema,
    adjustStockSchema,
    bulkAdjustStockSchema,
    inventoryLogQuerySchema
};
