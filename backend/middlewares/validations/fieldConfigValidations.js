const Joi = require('joi');
const {
    FIELD_REGISTRY,
    CUSTOM_FIELD_TYPES,
    CUSTOM_FIELD_PLACEMENTS,
    CUSTOM_FIELD_KEY_PATTERN,
    MAX_CUSTOM_FIELDS_PER_ENTITY,
    CUSTOM_FIELD_TEXT_MAX_LENGTH,
    CUSTOM_FIELD_LABEL_MAX_LENGTH,
    CUSTOM_FIELD_MAX_OPTIONS
} = require('../../constants/fieldConfigConstants');

// Shape of ONE entity's field config (models/VendorFieldConfig.js), as written
// in the JSON file scripts/manageVendorFieldConfig.js reads. Everything that
// names a built-in field is checked against FIELD_REGISTRY, so a typo in the
// file can never hide something that isn't wired for hiding.

const entityKeys = Object.keys(FIELD_REGISTRY);
const registryFieldsOf = (entity) => Object.keys(FIELD_REGISTRY[entity]?.fields || {});
const hideableFieldsOf = (entity) => registryFieldsOf(entity).filter((f) => FIELD_REGISTRY[entity].fields[f].hideable);
const renameableFieldsOf = (entity) => registryFieldsOf(entity).filter((f) => FIELD_REGISTRY[entity].fields[f].renameable);

const customFieldSchema = (entity) => Joi.object({
    key: Joi.string().trim().pattern(CUSTOM_FIELD_KEY_PATTERN)
        .invalid(...registryFieldsOf(entity))
        .required()
        .messages({
            'string.pattern.base': '{{#label}} must start with a letter and contain only letters and digits (max 40).',
            'any.invalid': '{{#label}} must not be the name of a built-in field.'
        })
        .label('Custom field key'),
    label: Joi.string().trim().min(1).max(CUSTOM_FIELD_LABEL_MAX_LENGTH).required().label('Custom field label'),
    type: Joi.string().valid(...Object.values(CUSTOM_FIELD_TYPES)).default(CUSTOM_FIELD_TYPES.TEXT).label('Custom field type'),
    options: Joi.when('type', {
        is: CUSTOM_FIELD_TYPES.SELECT,
        then: Joi.array().items(Joi.string().trim().min(1).max(CUSTOM_FIELD_TEXT_MAX_LENGTH)).min(1).max(CUSTOM_FIELD_MAX_OPTIONS)
            .unique((a, b) => a.toLowerCase() === b.toLowerCase()).required(),
        otherwise: Joi.array().max(0).default([])
            .messages({ 'array.max': '{{#label}} are only allowed for a select field.' })
    }).label('Custom field options'),
    required: Joi.boolean().default(false).label('Custom field required'),
    maxLength: Joi.when('type', {
        is: CUSTOM_FIELD_TYPES.TEXT,
        then: Joi.number().integer().min(1).max(CUSTOM_FIELD_TEXT_MAX_LENGTH).allow(null).default(null),
        otherwise: Joi.valid(null).default(null)
    }).label('Custom field maxLength'),
    placeholder: Joi.string().trim().max(100).allow(null, '').default(null).label('Custom field placeholder'),
    placement: Joi.object({
        mode: Joi.string().valid(...Object.values(CUSTOM_FIELD_PLACEMENTS)).default(CUSTOM_FIELD_PLACEMENTS.END),
        field: Joi.when('mode', {
            is: CUSTOM_FIELD_PLACEMENTS.END,
            then: Joi.valid(null).default(null),
            otherwise: Joi.string().valid(...registryFieldsOf(entity)).required()
        })
    }).default({ mode: CUSTOM_FIELD_PLACEMENTS.END, field: null }).label('Custom field placement'),
    showInAdminLists: Joi.boolean().default(true).label('Custom field showInAdminLists'),
    precedence: Joi.number().integer().min(0).default(0).label('Custom field precedence')
});

const entityFieldConfigSchema = (entity) => Joi.object({
    hiddenFields: Joi.array().items(Joi.string().valid(...hideableFieldsOf(entity))).unique().default([])
        .label('hiddenFields'),
    labelOverrides: Joi.array().items(Joi.object({
        field: Joi.string().valid(...renameableFieldsOf(entity)).required(),
        label: Joi.string().trim().min(1).max(CUSTOM_FIELD_LABEL_MAX_LENGTH).required()
    })).unique('field').default([]).label('labelOverrides'),
    customFields: Joi.array().items(customFieldSchema(entity)).max(MAX_CUSTOM_FIELDS_PER_ENTITY)
        .unique((a, b) => a.key.toLowerCase() === b.key.toLowerCase())
        .default([])
        .messages({ 'array.unique': 'Two custom fields have the same key.' })
        .label('customFields')
}).custom((config, helpers) => {
    // A field cannot be replaced unless it is hidden - otherwise both would show in the same spot.
    const hidden = new Set(config.hiddenFields);
    const notHidden = config.customFields.find((cf) => cf.placement.mode === CUSTOM_FIELD_PLACEMENTS.REPLACE && !hidden.has(cf.placement.field));
    if (notHidden) {
        return helpers.message(`Custom field "${notHidden.key}" replaces "${notHidden.placement.field}", which must also be in hiddenFields.`);
    }
    // Before / after a hidden field would never be drawn.
    const nextToHidden = config.customFields.find((cf) => [CUSTOM_FIELD_PLACEMENTS.BEFORE, CUSTOM_FIELD_PLACEMENTS.AFTER].includes(cf.placement.mode) && hidden.has(cf.placement.field));
    if (nextToHidden) {
        return helpers.message(`Custom field "${nextToHidden.key}" is placed next to "${nextToHidden.placement.field}", which is hidden - use mode "replace" instead.`);
    }
    return config;
});

// The whole file: { "<entity>": { hiddenFields, labelOverrides, customFields }, ... }
const vendorFieldConfigFileSchema = Joi.object(
    Object.fromEntries(entityKeys.map((entity) => [entity, entityFieldConfigSchema(entity)]))
).min(1).messages({ 'object.min': 'The file must configure at least one entity.' });

module.exports = {
    entityFieldConfigSchema,
    vendorFieldConfigFileSchema
};
