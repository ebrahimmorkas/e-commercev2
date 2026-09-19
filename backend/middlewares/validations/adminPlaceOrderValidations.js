const Joi = require('joi');
const {
    VALID_USER_SEARCH_FIELD_KEYS,
    USER_DROPDOWN_MAX_LIMIT,
    MAX_ORDER_LINE_ITEMS,
    MAX_LINE_ITEM_QUANTITY
} = require('../../constants/adminPlaceOrderConstants');

const objectId = () => Joi.string().trim().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.',
    'string.empty': '{{#label}} is required.'
});

// Money: a finite, non-negative number with at most 2 decimal places.
const money = () => Joi.number().min(0).max(100000000).precision(2).messages({
    'number.base': '{{#label}} must be a number.',
    'number.min': '{{#label}} cannot be negative.',
    'number.max': '{{#label}} is too large.'
});

const usersQuerySchema = Joi.object({
    searchField: Joi.string().trim().valid(...VALID_USER_SEARCH_FIELD_KEYS).required().label('Search field').messages({
        'any.only': `Search field must be one of: ${VALID_USER_SEARCH_FIELD_KEYS.join(', ')}.`
    }),
    search: Joi.string().trim().max(100).allow('').label('Search text'),
    limit: Joi.number().integer().min(1).max(USER_DROPDOWN_MAX_LIMIT).label('Limit')
});

const userIdParamSchema = Joi.object({
    userId: objectId().required().label('User')
});

const productsQuerySchema = Joi.object({
    categoryId: objectId().allow('', null).label('Category'),
    search: Joi.string().trim().max(100).allow('').label('Search text')
});

const productIdParamSchema = Joi.object({
    productId: objectId().required().label('Product')
});

const orderLineItemSchema = Joi.object({
    productId: objectId().required().label('Product'),
    variantId: objectId().required().label('Variant'),
    sizeId: objectId().required().label('Size'),
    quantity: Joi.number().integer().min(1).max(MAX_LINE_ITEM_QUANTITY).required().label('Quantity').messages({
        'number.base': '{{#label}} must be a number.',
        'number.integer': '{{#label}} must be a whole number.',
        'number.min': '{{#label}} must be at least 1.',
        'number.max': `{{#label}} cannot exceed ${MAX_LINE_ITEM_QUANTITY}.`
    })
});

const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;

const walkInCustomerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required().label('Name'),
    phone: Joi.string().trim().pattern(PHONE_PATTERN).required().label('Phone').messages({
        'string.pattern.base': '{{#label}} must be 10-14 digits, with an optional leading +.'
    }),
    whatsapp: Joi.string().trim().pattern(PHONE_PATTERN).allow('', null).label('WhatsApp').messages({
        'string.pattern.base': '{{#label}} must be 10-14 digits, with an optional leading +.'
    }),
    email: Joi.string().trim().lowercase().email().max(254).allow('', null).label('Email'),
    address: Joi.string().trim().max(1000).allow('', null).label('Address')
});

const placeOrderSchema = Joi.object({
    // "User out of System" (cash counter): no registered user, the admin types
    // the customer's details instead. The two modes exclude each other's fields.
    isWalkInCustomer: Joi.boolean().default(false).label('User out of system'),

    userId: Joi.when('isWalkInCustomer', {
        is: true,
        then: Joi.forbidden().messages({ 'any.unknown': 'User cannot be selected for a walk-in customer.' }),
        otherwise: objectId().required().label('User')
    }),

    walkInCustomer: Joi.when('isWalkInCustomer', {
        is: true,
        then: walkInCustomerSchema.required().label('Customer details'),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'Customer details are only allowed for a walk-in customer.' })
    }),

    // Only meaningful for walk-in orders (registered-user orders are always taxed).
    applyTax: Joi.when('isWalkInCustomer', {
        is: true,
        then: Joi.boolean().default(true).label('Apply tax'),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'Apply tax is only allowed for a walk-in customer.' })
    }),

    items: Joi.array()
        .items(orderLineItemSchema)
        .min(1)
        .max(MAX_ORDER_LINE_ITEMS)
        .unique((a, b) => a.productId === b.productId && a.variantId === b.variantId && a.sizeId === b.sizeId)
        .required()
        .label('Items')
        .messages({
            'array.min': 'Add at least one product to the order.',
            'array.max': `An order can have at most ${MAX_ORDER_LINE_ITEMS} items.`,
            'array.unique': 'The same product, variant and size is added more than once.'
        }),

    // Both address inputs are optional for admin-placed orders.
    // (For walk-ins the address lives inside walkInCustomer.address instead.)
    addressId: Joi.when('isWalkInCustomer', {
        is: true,
        then: Joi.forbidden().messages({ 'any.unknown': 'Saved addresses do not apply to a walk-in customer.' }),
        otherwise: objectId().allow('', null).label('Address')
    }),
    addressText: Joi.when('isWalkInCustomer', {
        is: true,
        then: Joi.forbidden().messages({ 'any.unknown': 'Use the customer address field for a walk-in customer.' }),
        otherwise: Joi.string().trim().max(1000).allow('', null).label('Address')
    }),

    shippingAmount: money().default(0).label('Shipping amount'),
    discountAmount: money().default(0).label('Discount amount'),

    // Only used when the vendor's CompanySettings.isOrderNumberAutoGenerated
    // is off - resolveOrderNumber (orderService.js) rejects it otherwise.
    orderNumber: Joi.string().trim().max(50).allow('', null).label('Order number'),
    remarks: Joi.string().trim().max(500).allow('', null).label('Remarks')
});

module.exports = {
    usersQuerySchema,
    userIdParamSchema,
    productsQuerySchema,
    productIdParamSchema,
    placeOrderSchema
};
