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

module.exports = {
    abandonedCartIdParamSchema
};
