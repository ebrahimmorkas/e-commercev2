const Joi = require('joi');
const { VALID_EMAIL_MODULES } = require('../../constants/emailModuleConstants');

// Template ids are common.encodeId-encoded (see formatTemplateForResponse in
// emailTemplateMasterController), never a raw hex ObjectId - so this is a
// loose opaque-string check, not a hex/length one.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// Order-step selection for the Order module when step-wise templates are on
// (ignored otherwise - see emailTemplateMasterService.planAssignment, which
// also checks the codes against the vendor's own steps). ALL/REMAINING are
// expanded server-side; CUSTOM needs the stepCodes themselves.
const stepFields = {
    stepSelection: Joi.string().valid('ALL', 'REMAINING', 'CUSTOM').label('Order steps selection'),
    stepCodes: Joi.array()
        .items(Joi.string().trim().uppercase().max(50).pattern(/^[A-Z0-9_]+$/).messages({
            'string.pattern.base': '{{#label}} must be a valid order step code.'
        }).label('Order step'))
        .max(100)
        .unique()
        .when('stepSelection', { is: 'CUSTOM', then: Joi.array().min(1).required() })
        .label('Order steps')
        .messages({ 'array.min': 'Please select at least one order step.', 'any.required': 'Please select at least one order step.' })
};

const addTemplateSchema = Joi.object({
    templateName: Joi.string().trim().min(2).max(100).required().label('Template name'),
    module: Joi.string().trim().valid(...VALID_EMAIL_MODULES).allow('', null).label('Module'),
    subject: Joi.string().trim().min(1).max(200).required().label('Subject'),
    htmlBody: Joi.string().min(1).required().label('HTML body'),
    textBody: Joi.string().allow('', null).label('Text body'),
    ...stepFields,
    // true once the vendor has confirmed taking the module (or order steps)
    // away from the template(s) currently holding it - see checkAssignment.
    confirmReassign: Joi.boolean().default(false).label('Confirm reassign')
});

const updateTemplateSchema = Joi.object({
    templateId: objectId().required().label('Template ID'),
    templateName: Joi.string().trim().min(2).max(100).label('Template name'),
    module: Joi.string().trim().valid(...VALID_EMAIL_MODULES).allow('', null).label('Module'),
    subject: Joi.string().trim().min(1).max(200).label('Subject'),
    htmlBody: Joi.string().min(1).label('HTML body'),
    textBody: Joi.string().allow('', null).label('Text body'),
    status: Joi.string().valid('A', 'I').label('Status'),
    ...stepFields,
    confirmReassign: Joi.boolean().default(false).label('Confirm reassign')
}).or('templateName', 'module', 'subject', 'htmlBody', 'textBody', 'status', 'stepSelection');

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

const changeTemplateModuleSchema = Joi.object({
    templateId: objectId().required().label('Template ID'),
    module: Joi.string().trim().valid(...VALID_EMAIL_MODULES).required().label('Module'),
    ...stepFields,
    confirmReassign: Joi.boolean().default(false).label('Confirm reassign')
});

const unassignTemplateModuleSchema = Joi.object({
    templateId: objectId().required().label('Template ID')
});

const bulkUnassignTemplateModuleSchema = Joi.object({
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
    changeTemplateModuleSchema,
    unassignTemplateModuleSchema,
    bulkUnassignTemplateModuleSchema,
    idParamSchema,
    moduleParamSchema
};
