const Joi = require('joi');
const { VALID_EMAIL_MODULES } = require('../../constants/emailModuleConstants');

// Template ids are common.encodeId-encoded (see formatTemplateForResponse in
// emailTemplateMasterController), never a raw hex ObjectId - so this is a
// loose opaque-string check, not a hex/length one.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

const addTemplateSchema = Joi.object({
    templateName: Joi.string().trim().min(2).max(100).required().label('Template name'),
    module: Joi.string().trim().max(50).allow('', null).label('Module'),
    subject: Joi.string().trim().min(1).max(200).required().label('Subject'),
    htmlBody: Joi.string().min(1).required().label('HTML body'),
    textBody: Joi.string().allow('', null).label('Text body')
});

const updateTemplateSchema = Joi.object({
    templateId: objectId().required().label('Template ID'),
    templateName: Joi.string().trim().min(2).max(100).label('Template name'),
    module: Joi.string().trim().max(50).allow('', null).label('Module'),
    subject: Joi.string().trim().min(1).max(200).label('Subject'),
    htmlBody: Joi.string().min(1).label('HTML body'),
    textBody: Joi.string().allow('', null).label('Text body'),
    status: Joi.string().valid('A', 'I').label('Status')
}).or('templateName', 'module', 'subject', 'htmlBody', 'textBody', 'status');

const deleteTemplateSchema = Joi.object({
    templateId: objectId().required().label('Template ID')
});

const bulkTemplateStatusSchema = Joi.object({
    templateIds: Joi.array().items(objectId().required()).min(1).max(50).unique().required().label('Template IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteTemplateSchema = Joi.object({
    templateIds: Joi.array().items(objectId().required()).min(1).max(50).unique().required().label('Template IDs')
});

const idParamSchema =Joi.object({
    id: objectId().required().label('Template ID')
});

const moduleParamSchema = Joi.object({
    module: Joi.string().valid(...VALID_EMAIL_MODULES).required().label('Module')
});

module.exports = {
    addTemplateSchema,
    updateTemplateSchema,
    deleteTemplateSchema,
    bulkTemplateStatusSchema,
    bulkDeleteTemplateSchema,
    idParamSchema,
    moduleParamSchema
};
