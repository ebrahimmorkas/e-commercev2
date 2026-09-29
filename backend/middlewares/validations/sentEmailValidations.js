const Joi = require('joi');

// Ids are common.encodeId-encoded - loose opaque-string check, decoded in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

const emailList = (label, max) => Joi.array()
    .items(Joi.string().trim().lowercase().email().label('Email address'))
    .max(max)
    .unique()
    .label(label);

// The request is multipart (files ride along), so booleans/numbers arrive as
// strings - Joi converts them. Arrays use the "name[]" convention.
const sendEmailSchema = Joi.object({
    subject: Joi.string().trim().min(1).max(200).required().label('Subject'),
    htmlBody: Joi.string().min(1).max(500000).required().label('Body'),
    textBody: Joi.string().allow('', null).max(200000).label('Plain text body'),

    customerIds: Joi.array().items(objectId().label('Customer')).max(5000).unique().label('Customers'),
    groupIds: Joi.array().items(objectId().label('Group')).max(100).unique().label('Groups'),
    allCustomers: Joi.boolean().default(false).label('All customers'),
    // Addresses typed in (only people outside the store need
    // isSendingEmailToUsersOutOfStoreAllowed - checked in the service).
    externalEmails: emailList('Email addresses', 500),

    includeCompanyCcList: Joi.boolean().default(true).label('Include Company Settings CC list'),
    includeCompanyBccList: Joi.boolean().default(true).label('Include Company Settings BCC list'),
    ccList: emailList('CC list', 50),
    bccList: emailList('BCC list', 50),

    // Company Settings library entries ticked.
    attachmentIds: Joi.array().items(objectId().label('Attachment')).max(100).unique().label('Attachments'),
    imageIds: Joi.array().items(objectId().label('Image')).max(100).unique().label('Images'),
    // Names for the uploaded images, in upload order ({{image:name}}).
    uploadImageNames: Joi.array().items(Joi.string().trim().lowercase().max(40).label('Image name')).max(100).label('Image names')
}).custom((value, helpers) => {
    const hasSomeone = value.allCustomers || (value.customerIds || []).length || (value.groupIds || []).length || (value.externalEmails || []).length;
    return hasSomeone ? value : helpers.error('any.custom', { message: 'Please choose who to send the email to.' });
}).messages({ 'any.custom': '{{#message}}' });

const historyQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(100).default(20).label('Limit')
});

const customerSearchQuerySchema = Joi.object({
    q: Joi.string().trim().allow('').max(100).label('Search')
});

const idParamSchema = Joi.object({
    id: objectId().required().label('Sent email id')
});

module.exports = {
    sendEmailSchema,
    historyQuerySchema,
    customerSearchQuerySchema,
    idParamSchema
};
