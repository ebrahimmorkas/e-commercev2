const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const addToCartSchema = Joi.object({
    productId: objectId().required().label('Product ID'),
    variantId: objectId().required().label('Variant ID'),
    sizeId: objectId().required().label('Size ID'),
    quantity: Joi.number().integer().min(1).default(1).label('Quantity')
});

const updateCartItemSchema = Joi.object({
    productId: objectId().required().label('Product ID'),
    variantId: objectId().required().label('Variant ID'),
    sizeId: objectId().required().label('Size ID'),
    // 0 is allowed here on purpose - the service treats "update to 0" as
    // "remove this item", matching how most storefront cart UIs let you
    // hit the minus button down to zero instead of forcing a separate
    // remove action.
    quantity: Joi.number().integer().min(0).required().label('Quantity')
});

const removeCartItemSchema = Joi.object({
    productId: objectId().required().label('Product ID'),
    variantId: objectId().required().label('Variant ID'),
    sizeId: objectId().required().label('Size ID')
});

const applyDiscountsSchema = Joi.object({
    discountIds: Joi.array().items(objectId()).default([]).label('Discount IDs'),
    couponCode: Joi.string().trim().uppercase().allow('', null).label('Coupon code')
})
    .custom((value, helpers) => {
        if ((value.discountIds || []).length === 0 && !value.couponCode) {
            return helpers.error('discounts.empty');
        }
        return value;
    })
    .messages({ 'discounts.empty': 'Select at least one discount or enter a coupon code.' });

module.exports = {
    addToCartSchema,
    updateCartItemSchema,
    removeCartItemSchema,
    applyDiscountsSchema
};
