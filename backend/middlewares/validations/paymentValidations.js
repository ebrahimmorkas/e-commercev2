const Joi = require('joi');
const { VALID_PAYMENT_GATEWAYS } = require('../../constants/paymentGatewayConstants');

// orderId is common.encodeId-encoded (see orderController.js's
// formatOrderForResponse) - opaque-string check, decoded via
// common.decodeId in paymentController.js before reaching the service.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

const orderIdParamSchema = Joi.object({
    orderId: objectId().required().label('Order ID')
});

// Rejects an unsupported gateway name at the route boundary (before the
// controller/service ever run) - keeps handleGatewayCallback from ever being
// invoked with a key paymentProviderFactory doesn't know about.
const gatewayCallbackParamSchema = Joi.object({
    gateway: Joi.string().trim().lowercase().valid(...VALID_PAYMENT_GATEWAYS).required().label('Gateway')
});

module.exports = {
    orderIdParamSchema,
    gatewayCallbackParamSchema
};
