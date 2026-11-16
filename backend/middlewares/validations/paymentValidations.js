const Joi = require('joi');
const { VALID_PAYMENT_GATEWAYS } = require('../../constants/paymentGatewayConstants');
const {
    CHECKOUT_ISSUE_REASONS,
    CHECKOUT_ISSUE_MESSAGE_MAX_LENGTH,
    CHECKOUT_ISSUE_TOTAL_MAX_LENGTH,
    CHECKOUT_ISSUE_PAGE_URL_MAX_LENGTH
} = require('../../constants/checkoutIssueConstants');

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

// A customer reporting that checkout offers no way to pay. Everything except
// the reason is what the customer's browser saw - shown in the email as such;
// the customer's own details are read from their account, never from here.
const reportCheckoutIssueSchema = Joi.object({
    reason: Joi.string().valid(...Object.values(CHECKOUT_ISSUE_REASONS)).required().label('Reason'),
    errorMessage: Joi.string().trim().max(CHECKOUT_ISSUE_MESSAGE_MAX_LENGTH).allow('', null).default(null).label('Error message'),
    cartTotal: Joi.string().trim().max(CHECKOUT_ISSUE_TOTAL_MAX_LENGTH).allow('', null).default(null).label('Cart total'),
    itemCount: Joi.number().integer().min(0).max(100000).allow(null).default(null).label('Item count'),
    pageUrl: Joi.string().trim().max(CHECKOUT_ISSUE_PAGE_URL_MAX_LENGTH).uri({ scheme: ['http', 'https'] }).allow('', null).default(null).label('Page')
});

module.exports = {
    reportCheckoutIssueSchema,
    orderIdParamSchema,
    gatewayCallbackParamSchema
};
