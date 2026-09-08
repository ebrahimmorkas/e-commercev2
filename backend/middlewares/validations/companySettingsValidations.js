const Joi = require('joi');
const { VALID_EMAIL_MODULES } = require('../../constants/emailModuleConstants');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const assignEmailTemplateSchema = Joi.object({
    module: Joi.string().valid(...VALID_EMAIL_MODULES).required().label('Module'),
    templateId: objectId().required().label('Template ID')
});

const unassignEmailTemplateSchema = Joi.object({
    module: Joi.string().valid(...VALID_EMAIL_MODULES).required().label('Module')
});

module.exports = {
    assignEmailTemplateSchema,
    unassignEmailTemplateSchema
};
