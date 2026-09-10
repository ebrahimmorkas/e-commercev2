const Joi = require('joi');
const { VALID_PAYMENT_GATEWAYS } = require('../../constants/paymentGatewayConstants');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
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
