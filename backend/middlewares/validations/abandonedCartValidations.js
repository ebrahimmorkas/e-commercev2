const Joi = require('joi');

// Abandoned cart ids are common.encodeId-encoded (see
// formatAbandonedCartGroupForResponse in abandonedCartController.js), never
// raw hex ObjectIds - opaque-string check, decoded via common.decodeId in the
// controller before reaching the service.
const abandonedCartIdParamSchema = Joi.object({
    id: Joi.string().trim().min(1).max(200).pattern(/^[A-Za-z0-9_-]+$/).required().label('Abandoned cart')
        .messages({
            'string.empty': '{{#label}} is required.',
            'string.max': '{{#label}} is not a valid id.',
            'string.pattern.base': '{{#label}} is not a valid id.'
        })
});

// "Place order directly": the delivery address is required, and is exactly
// one of the customer's saved addresses (an encoded id, as the Place Order
// address list returns it) or an address typed by the admin (stored on the
// order only, never saved to the customer's address book).
const placeOrderFromAbandonedCartSchema = Joi.object({
    addressId: Joi.string().trim().min(1).max(200).pattern(/^[A-Za-z0-9_-]+$/).label('Saved address')
        .messages({
            'string.empty': '{{#label}} is required.',
            'string.max': '{{#label}} is not a valid id.',
            'string.pattern.base': '{{#label}} is not a valid id.'
        }),
    addressText: Joi.string().trim().min(5).max(1000).pattern(/[A-Za-z0-9]/).label('Delivery address')
        .messages({
            'string.empty': '{{#label}} is required.',
            'string.min': '{{#label}} must be at least 5 characters.',
            'string.max': '{{#label}} cannot exceed 1000 characters.',
            'string.pattern.base': '{{#label}} must contain letters or numbers.'
        })
})
    .xor('addressId', 'addressText')
    .required()
    .messages({
        'object.missing': 'Choose a saved address or enter the delivery address.',
        'object.xor': 'Provide either a saved address or a typed address, not both.',
        'any.required': 'Choose a saved address or enter the delivery address.'
    });

module.exports = {
    abandonedCartIdParamSchema,
    placeOrderFromAbandonedCartSchema
};
