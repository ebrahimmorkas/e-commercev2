const VendorFieldConfig = require('../models/VendorFieldConfig');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    FIELD_REGISTRY,
    CUSTOM_FIELD_TYPES,
    CUSTOM_FIELD_TEXT_MAX_LENGTH
} = require('../constants/fieldConfigConstants');

// Per-vendor field configuration - see constants/fieldConfigConstants.js.
// fieldConfigData (what every helper here takes) is one vendor's whole config:
//   { [entity]: { hiddenFields: [], labelOverrides: { field: label }, customFields: [...] } }
// An entity the vendor has not configured is simply missing from it.

const EMPTY_ENTITY_CONFIG = Object.freeze({ hiddenFields: [], labelOverrides: {}, customFields: [] });

const shapeEntityConfig = (doc) => {
    try {
        return {
            hiddenFields: [...(doc.hiddenFields || [])],
            labelOverrides: Object.fromEntries((doc.labelOverrides || []).map((o) => [o.field, o.label])),
            customFields: [...(doc.customFields || [])]
                .sort((a, b) => (a.precedence || 0) - (b.precedence || 0))
                .map((cf) => ({
                    key: cf.key,
                    label: cf.label,
                    type: cf.type || CUSTOM_FIELD_TYPES.TEXT,
                    options: [...(cf.options || [])],
                    required: !!cf.required,
                    maxLength: cf.maxLength ?? null,
                    placeholder: cf.placeholder || null,
                    placement: { mode: cf.placement?.mode || 'end', field: cf.placement?.field || null },
                    showInAdminLists: cf.showInAdminLists !== false,
                    precedence: cf.precedence || 0
                }))
        };
    } catch (err) {
        throw err;
    }
};

// From the DB - always an object (never null), so Redis caches "no config" too.
const fetchVendorFieldConfig = async (vendorId) => {
    try {
        const docs = await VendorFieldConfig.find({ vendorId, status: 'A' }).lean();
        return Object.fromEntries(docs.map((doc) => [doc.entity, shapeEntityConfig(doc)]));
    } catch (err) {
        throw err;
    }
};

const getVendorFieldConfig = async (vendorId) => {
    try {
        const config = await redisService.getOrSet(
            redisKeys.fieldConfig(vendorId),
            async () => await fetchVendorFieldConfig(vendorId),
            3600
        );
        return config || {};
    } catch (err) {
        throw err;
    }
};

const invalidateVendorFieldConfig = async (vendorId) => {
    try {
        await redisService.del(redisKeys.fieldConfig(vendorId));
    } catch (err) {
        throw err;
    }
};

const getEntityConfig = (fieldConfigData, entity) => {
    try {
        return fieldConfigData?.[entity] || EMPTY_ENTITY_CONFIG;
    } catch (err) {
        throw err;
    }
};

const isFieldHidden = (fieldConfigData, entity, field) => {
    try {
        return getEntityConfig(fieldConfigData, entity).hiddenFields.includes(field);
    } catch (err) {
        throw err;
    }
};

const labelOf = (fieldConfigData, entity, field) => {
    try {
        return getEntityConfig(fieldConfigData, entity).labelOverrides[field]
            || FIELD_REGISTRY[entity]?.fields?.[field]?.label
            || field;
    } catch (err) {
        throw err;
    }
};

// A COPY of companySettingsData with every setting a hidden field forces (e.g.
// a hidden code is always auto-generated), so the code paths that read those
// settings keep doing the field's job without knowing it is hidden. The cached
// object itself is never modified.
const applyHiddenFieldSettings = (companySettingsData, fieldConfigData) => {
    try {
        const forced = {};
        for (const [entity, entityRegistry] of Object.entries(FIELD_REGISTRY)) {
            for (const field of getEntityConfig(fieldConfigData, entity).hiddenFields) {
                Object.assign(forced, entityRegistry.fields[field]?.forcedSettingsWhenHidden || {});
            }
        }
        if (Object.keys(forced).length === 0) return companySettingsData;
        return { ...(companySettingsData || {}), ...forced };
    } catch (err) {
        throw err;
    }
};

const isBlankValue = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Checks one value against its custom field definition. Returns
// { value } (normalised; undefined = empty) or { error }.
const normalizeCustomFieldValue = (definition, rawValue) => {
    try {
        if (isBlankValue(rawValue)) return { value: undefined };

        if (definition.type === CUSTOM_FIELD_TYPES.NUMBER) {
            const number = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).trim());
            if (!Number.isFinite(number)) return { error: `${definition.label} must be a number.` };
            return { value: number };
        }

        const text = String(rawValue).trim();
        if (definition.type === CUSTOM_FIELD_TYPES.SELECT) {
            const option = definition.options.find((o) => o.toLowerCase() === text.toLowerCase());
            if (!option) return { error: `${definition.label} must be one of: ${definition.options.join(', ')}.` };
            return { value: option };
        }

        const maxLength = definition.maxLength || CUSTOM_FIELD_TEXT_MAX_LENGTH;
        if (text.length > maxLength) return { error: `${definition.label} must be at most ${maxLength} characters.` };
        return { value: text };
    } catch (err) {
        throw err;
    }
};

// values: [{ key, value }] as submitted. Keys the vendor's config does not
// define are dropped (e.g. a field removed from the config since), every
// defined field is checked, and empty values are not stored. meta.customFieldValues
// is what gets saved, in the config's order.
const normalizeCustomFieldValues = (fieldConfigData, entity, values) => {
    try {
        const { customFields } = getEntityConfig(fieldConfigData, entity);
        const submitted = new Map((Array.isArray(values) ? values : []).map((entry) => [entry?.key, entry?.value]));

        const normalized = [];
        const errors = [];
        for (const definition of customFields) {
            const result = normalizeCustomFieldValue(definition, submitted.get(definition.key));
            if (result.error) {
                errors.push(result.error);
                continue;
            }
            if (result.value === undefined) {
                if (definition.required) errors.push(`${definition.label} is required.`);
                continue;
            }
            normalized.push({ key: definition.key, value: result.value });
        }

        if (errors.length > 0) {
            return common.returnResult(false, 400, errors.join(' '));
        }
        return common.returnResult(true, 200, 'All Good', { customFieldValues: normalized });
    } catch (err) {
        throw err;
    }
};

// What the admin panel needs to draw its forms/lists: the vendor's config per
// entity plus the registry's default labels (so a rename can fall back).
const fetchFieldConfigForAdmin = async (vendorId) => {
    try {
        const fieldConfigData = await getVendorFieldConfig(vendorId);
        const entities = {};
        for (const [entity, entityRegistry] of Object.entries(FIELD_REGISTRY)) {
            const config = getEntityConfig(fieldConfigData, entity);
            entities[entity] = {
                hiddenFields: config.hiddenFields,
                labelOverrides: config.labelOverrides,
                customFields: config.customFields,
                defaultLabels: Object.fromEntries(Object.entries(entityRegistry.fields).map(([field, def]) => [field, def.label]))
            };
        }
        logger.logInfo(1, 0, 'Field config fetched', { vendorId });
        return common.returnResult(true, 200, 'Field config fetched successfully', { entities });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchVendorFieldConfig,
    getVendorFieldConfig,
    invalidateVendorFieldConfig,
    getEntityConfig,
    isFieldHidden,
    labelOf,
    applyHiddenFieldSettings,
    normalizeCustomFieldValues,
    normalizeCustomFieldValue,
    fetchFieldConfigForAdmin
};
