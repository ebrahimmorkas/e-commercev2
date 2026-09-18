const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkUserStatusSchema = Joi.object({
    userIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Customer IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteUserSchema = Joi.object({
    userIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Customer IDs')
});

module.exports = {
    bulkUserStatusSchema,
    bulkDeleteUserSchema
};
