const Joi = require('joi');

// Ids are common.encodeId-encoded, never raw hex - loose opaque-string check,
// decoded in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// Same rules as customers (userValidations.js) so an agent account is held to
// the same standard.
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const PHONE_PATTERN_MESSAGE = '{{#label}} must contain only digits, with an optional leading +.';
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const USERNAME_PATTERN_MESSAGE = '{{#label}} may only contain lowercase letters, numbers, dots and underscores.';
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_PATTERN_MESSAGE = '{{#label}} must contain at least one uppercase letter, one lowercase letter and one number.';

const name = () => Joi.string().trim().min(2).max(50).label('Name');
const username = () => Joi.string().trim().lowercase().min(3).max(30).pattern(USERNAME_PATTERN)
    .label('Username').messages({ 'string.pattern.base': USERNAME_PATTERN_MESSAGE });
const email = () => Joi.string().trim().lowercase().email().max(254).label('Email');
const phone = (label) => Joi.string().trim().min(10).max(14).pattern(PHONE_PATTERN)
    .label(label).messages({ 'string.pattern.base': PHONE_PATTERN_MESSAGE });
const password = (label) => Joi.string().min(8).max(128).pattern(PASSWORD_PATTERN)
    .label(label).messages({ 'string.pattern.base': PASSWORD_PATTERN_MESSAGE });
// Optional for an agent; '' / null clears it. Country, state and city go
// together (checked in deliveryAgentService against the store's locations).
const optionalLocation = (label) => Joi.string().trim().allow('', null).label(label);

const deliveryAgentIdParamSchema = Joi.object({
    id: objectId().required().label('Delivery agent ID')
});

const createDeliveryAgentSchema = Joi.object({
    name: name().required(),
    username: username().required(),
    email: email().required(),
    phone_no: phone('Phone number').required(),
    whatsapp_no: phone('WhatsApp number').allow('', null),
    password: password('Password').required(),
    country: optionalLocation('Country'),
    state: optionalLocation('State'),
    city: optionalLocation('City')
});

// Password and status have their own endpoints.
const updateDeliveryAgentSchema = Joi.object({
    name: name(),
    username: username(),
    email: email(),
    phone_no: phone('Phone number'),
    whatsapp_no: phone('WhatsApp number').allow('', null),
    country: optionalLocation('Country'),
    state: optionalLocation('State'),
    city: optionalLocation('City')
}).min(1).messages({ 'object.min': 'At least one field must be provided to update.' });

const changeDeliveryAgentPasswordSchema = Joi.object({
    newPassword: password('New password').required()
});

const setDeliveryAgentStatusSchema = Joi.object({
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const agentOrdersQuerySchema = Joi.object({
    view: Joi.string().valid('pending', 'done').default('pending').label('View')
});

module.exports = {
    deliveryAgentIdParamSchema,
    createDeliveryAgentSchema,
    updateDeliveryAgentSchema,
    changeDeliveryAgentPasswordSchema,
    setDeliveryAgentStatusSchema,
    agentOrdersQuerySchema
};
