const Joi = require('joi');
const {
    BANK_FIELD_TYPES,
    BANK_FIELD_OPTION_TYPES,
    BANK_FIELD_TEXT_TYPES,
    BANK_FIELD_KEY_PATTERN,
    MAX_BANK_FIELDS_PER_COUNTRY,
    BANK_FIELD_LABEL_MAX_LENGTH,
    BANK_FIELD_PLACEHOLDER_MAX_LENGTH,
    BANK_FIELD_PATTERN_MAX_LENGTH,
    BANK_FIELD_PATTERN_MESSAGE_MAX_LENGTH,
    BANK_FIELD_MAX_OPTIONS,
    BANK_FIELD_OPTION_MAX_LENGTH,
    BANK_FIELD_TEXT_MAX_LENGTH,
    BANK_FIELD_TEXTAREA_MAX_LENGTH
} = require('../../constants/bankFieldConstants');

/*
|--------------------------------------------------------------------------
| 1. A bank field's DEFINITION (models/BankFieldTemplate.js fields[])
|--------------------------------------------------------------------------
| Templates are edited directly in the DB, so this is what
| bankFieldTemplateService checks every field against when it reads one
| (a field that fails is skipped and logged), and what the seed checks its
| own templates against before saving.
*/

const isTextType = (type) => BANK_FIELD_TEXT_TYPES.includes(type);
const isOptionType = (type) => BANK_FIELD_OPTION_TYPES.includes(type);

// The pattern must be a regular expression JavaScript can compile.
const compilablePattern = (value, helpers) => {
    try {
        new RegExp(value);
        return value;
    } catch (err) {
        return helpers.message(`{{#label}} is not a valid regular expression (${err.message}).`);
    }
};

const bankFieldOptionSchema = Joi.object({
    value: Joi.string().trim().min(1).max(BANK_FIELD_OPTION_MAX_LENGTH).required().label('Option value'),
    label: Joi.string().trim().min(1).max(BANK_FIELD_OPTION_MAX_LENGTH).required().label('Option label')
});

const bankFieldDefinitionSchema = Joi.object({
    key: Joi.string().trim().pattern(BANK_FIELD_KEY_PATTERN).required()
        .messages({ 'string.pattern.base': '{{#label}} must start with a letter and contain only letters and digits (max 40).' })
        .label('Field key'),
    label: Joi.string().trim().min(1).max(BANK_FIELD_LABEL_MAX_LENGTH).required().label('Field label'),
    type: Joi.string().valid(...Object.values(BANK_FIELD_TYPES)).default(BANK_FIELD_TYPES.TEXT).label('Field type'),
    isRequired: Joi.boolean().default(false).label('Field isRequired'),
    placeholder: Joi.string().trim().max(BANK_FIELD_PLACEHOLDER_MAX_LENGTH).allow('', null).default(null).label('Field placeholder'),
    minLength: Joi.when('type', {
        is: Joi.valid(...BANK_FIELD_TEXT_TYPES),
        then: Joi.number().integer().min(0).max(BANK_FIELD_TEXTAREA_MAX_LENGTH).allow(null).default(null),
        otherwise: Joi.valid(null).default(null)
            .messages({ 'any.only': '{{#label}} is only allowed for a text or textarea field.' })
    }).label('Field minLength'),
    maxLength: Joi.when('type', {
        is: Joi.valid(...BANK_FIELD_TEXT_TYPES),
        then: Joi.number().integer().min(1)
            .when('type', { is: BANK_FIELD_TYPES.TEXTAREA, then: Joi.number().max(BANK_FIELD_TEXTAREA_MAX_LENGTH), otherwise: Joi.number().max(BANK_FIELD_TEXT_MAX_LENGTH) })
            .allow(null).default(null),
        otherwise: Joi.valid(null).default(null)
            .messages({ 'any.only': '{{#label}} is only allowed for a text or textarea field.' })
    }).label('Field maxLength'),
    min: Joi.when('type', {
        is: BANK_FIELD_TYPES.NUMBER,
        then: Joi.number().allow(null).default(null),
        otherwise: Joi.valid(null).default(null)
            .messages({ 'any.only': '{{#label}} is only allowed for a number field.' })
    }).label('Field min'),
    max: Joi.when('type', {
        is: BANK_FIELD_TYPES.NUMBER,
        then: Joi.number().allow(null).default(null),
        otherwise: Joi.valid(null).default(null)
            .messages({ 'any.only': '{{#label}} is only allowed for a number field.' })
    }).label('Field max'),
    pattern: Joi.when('type', {
        is: Joi.valid(...BANK_FIELD_TEXT_TYPES),
        then: Joi.string().max(BANK_FIELD_PATTERN_MAX_LENGTH).custom(compilablePattern).allow('', null).default(null),
        otherwise: Joi.valid(null, '').default(null)
            .messages({ 'any.only': '{{#label}} is only allowed for a text or textarea field.' })
    }).label('Field pattern'),
    patternMessage: Joi.string().trim().max(BANK_FIELD_PATTERN_MESSAGE_MAX_LENGTH).allow('', null).default(null).label('Field patternMessage'),
    isUppercase: Joi.boolean().default(false).label('Field isUppercase'),
    options: Joi.when('type', {
        is: Joi.valid(...BANK_FIELD_OPTION_TYPES),
        then: Joi.array().items(bankFieldOptionSchema).min(1).max(BANK_FIELD_MAX_OPTIONS)
            .unique((a, b) => a.value.toLowerCase() === b.value.toLowerCase())
            .required()
            .messages({ 'array.unique': '{{#label}} contain the same value twice.' }),
        otherwise: Joi.array().max(0).default([])
            .messages({ 'array.max': '{{#label}} are only allowed for a radio, dropdown or checkbox field.' })
    }).label('Field options'),
    displayOrder: Joi.number().integer().min(0).default(0).label('Field displayOrder'),
    status: Joi.string().valid('A', 'I').default('A').label('Field status')
}).custom((field, helpers) => {
    if (isTextType(field.type) && field.minLength != null && field.maxLength != null && field.minLength > field.maxLength) {
        return helpers.message(`Field "${field.key}": minLength cannot be more than maxLength.`);
    }
    if (field.type === BANK_FIELD_TYPES.NUMBER && field.min != null && field.max != null && field.min > field.max) {
        return helpers.message(`Field "${field.key}": min cannot be more than max.`);
    }
    return field;
});

// A whole template's field list (the seed checks its templates with this).
const bankFieldTemplateFieldsSchema = Joi.array().items(bankFieldDefinitionSchema)
    .min(1)
    .max(MAX_BANK_FIELDS_PER_COUNTRY)
    .unique((a, b) => String(a.key).toLowerCase() === String(b.key).toLowerCase())
    .messages({ 'array.unique': 'Two bank fields have the same key.' })
    .label('Bank fields');

/*
|--------------------------------------------------------------------------
| 2. The vendor's VALUES for a template's fields
|--------------------------------------------------------------------------
| Built per request from the (already checked) fields of the vendor's store
| country - see bankFieldTemplateService.validateBankDetailValues.
| enforceRequired: false while every value is empty (the vendor is clearing
| their bank details, or never filled them in).
*/

// Every value comes out as: a string / number / option value, null when empty
// (blank or only spaces), and for a checkbox a list ([] when nothing ticked).
const valueSchemaFor = (field, enforceRequired) => {
    const label = field.label;
    const isRequired = field.isRequired && enforceRequired;
    const requiredMessages = { 'any.required': `${label} is required.`, 'array.min': `${label} is required.` };
    let schema;

    if (isTextType(field.type)) {
        const hardMax = field.type === BANK_FIELD_TYPES.TEXTAREA ? BANK_FIELD_TEXTAREA_MAX_LENGTH : BANK_FIELD_TEXT_MAX_LENGTH;
        const maxLength = Math.min(field.maxLength || hardMax, hardMax);
        schema = Joi.string().trim().max(maxLength);
        if (field.isUppercase) schema = schema.uppercase();
        if (field.minLength) schema = schema.min(field.minLength);
        if (field.pattern) schema = schema.pattern(new RegExp(field.pattern));
        // With a format message, a wrong length is the same mistake - say it the same way.
        schema = schema.empty(Joi.valid('', null)).messages({
            'string.pattern.base': field.patternMessage || `${label} is not in the right format.`,
            'string.min': field.patternMessage || `${label} must be at least ${field.minLength} characters.`,
            'string.max': field.patternMessage || `${label} must be at most ${maxLength} characters.`,
            'string.base': `${label} must be text.`
        });
    } else if (field.type === BANK_FIELD_TYPES.NUMBER) {
        schema = Joi.number();
        if (field.min != null) schema = schema.min(field.min);
        if (field.max != null) schema = schema.max(field.max);
        schema = schema.empty(Joi.valid('', null)).messages({
            'number.base': `${label} must be a number.`,
            'number.min': `${label} must be ${field.min} or more.`,
            'number.max': `${label} must be ${field.max} or less.`,
            'number.unsafe': `${label} is too large.`
        });
    } else if (field.type === BANK_FIELD_TYPES.CHECKBOX) {
        const optionValues = field.options.map((option) => option.value);
        schema = Joi.array().items(Joi.string().valid(...optionValues)).single().unique()
            .empty(Joi.valid('', null))
            .messages({ 'any.only': `${label} has a choice that is not one of its options.`, 'array.unique': `${label} has the same choice twice.` });
        if (isRequired) schema = schema.min(1);
    } else {
        // radio / dropdown - exactly one option
        const optionValues = field.options.map((option) => option.value);
        schema = Joi.string().valid(...optionValues).empty(Joi.valid('', null))
            .messages({ 'any.only': `${label} must be one of: ${field.options.map((option) => option.label).join(', ')}.` });
    }

    schema = isRequired
        ? schema.required().messages(requiredMessages)
        : schema.default(field.type === BANK_FIELD_TYPES.CHECKBOX ? [] : null);
    return schema.label(label);
};

const buildBankDetailValuesSchema = (fields, enforceRequired) => Joi.object(
    Object.fromEntries(fields.map((field) => [field.key, valueSchemaFor(field, enforceRequired)]))
).unknown(false).messages({ 'object.unknown': '{{#key}} is not a bank field of your store country.' });

/*
|--------------------------------------------------------------------------
| 3. The bankDetails part of the Company Settings save request
|--------------------------------------------------------------------------
| { countryId, values: { <fieldKey>: <value> } } - sent as a JSON string
| (the save is multipart/form-data, see companySettingsApi.js) and parsed
| here; a plain object (JSON body) is accepted too. countryId is the store
| country the values belong to (encoded, like storeCountryId). Only the shape
| is checked here; the values are checked against that country's template in
| companySettingsService.prepareBankDetails.
*/
const bankDetailValueSchema = Joi.alternatives().try(
    Joi.string().allow('').max(BANK_FIELD_TEXTAREA_MAX_LENGTH),
    Joi.number(),
    Joi.array().items(Joi.string().max(BANK_FIELD_OPTION_MAX_LENGTH)).max(BANK_FIELD_MAX_OPTIONS)
).allow(null).messages({ 'alternatives.match': '{{#label}} must be text, a number or a list of choices.' });

const bankDetailsObjectSchema = Joi.object({
    countryId: Joi.string().trim().min(1).max(200).required().label('Bank details country'),
    values: Joi.object()
        .pattern(BANK_FIELD_KEY_PATTERN, bankDetailValueSchema)
        .max(MAX_BANK_FIELDS_PER_COUNTRY)
        .default({})
        .messages({ 'object.unknown': 'Bank details contain a field name that is not allowed ({{#key}}).' })
        .label('Bank details')
});

const bankDetailsRequestSchema = Joi.any().custom((input, helpers) => {
    let parsed = input;
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input);
        } catch (err) {
            return helpers.message('Bank details are not in the right format.');
        }
    }
    const { error, value } = bankDetailsObjectSchema.validate(parsed, { errors: { wrap: { label: false } } });
    if (error) {
        return helpers.message(error.details[0].message.replace(/"/g, ''));
    }
    return value;
}).label('Bank details');

module.exports = {
    bankFieldDefinitionSchema,
    bankFieldTemplateFieldsSchema,
    buildBankDetailValuesSchema,
    bankDetailsRequestSchema
};
