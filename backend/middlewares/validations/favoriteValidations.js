const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const addToFavoritesSchema = Joi.object({
    productId: objectId().required().label('Product ID'),
    variantId: objectId().required().label('Variant ID'),
    sizeId: objectId().required().label('Size ID')
});

const removeFromFavoritesSchema = Joi.object({
    productId: objectId().required().label('Product ID'),
    variantId: objectId().required().label('Variant ID'),
    sizeId: objectId().required().label('Size ID')
});

const listFavoritesQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).optional().label('Page'),
    limit: Joi.number().integer().min(1).max(100).optional().label('Limit')
});

// Body for "place order from favorites" - each selected favorite is dropped
// into the user's cart (with its own quantity) and the existing order
// pipeline (orderService.createOrderFromCart) takes it from there, so this
// schema is just addToFavoritesSchema's sibling items[] plus the same
// address/orderNumber fields createOrderSchema (orderValidations.js) uses.
const createOrderFromFavoritesSchema = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                favoriteId: objectId().required().label('Favorite ID'),
                quantity: Joi.number().integer().min(1).default(1).label('Quantity')
            })
        )
        .min(1)
        .required()
        .label('Items'),
    shippingAddressId: objectId().required().label('Shipping address'),
    billingAddressId: objectId().allow(null, '').label('Billing address'),
    orderNumber: Joi.string().trim().max(50).allow(null, '').label('Order number')
});

module.exports = {
    addToFavoritesSchema,
    removeFromFavoritesSchema,
    listFavoritesQuerySchema,
    createOrderFromFavoritesSchema
};
