const BankFieldTemplate = require('../models/BankFieldTemplate');
const CountryMaster = require('../models/CountryMaster');
const logger = require('../utils/logger');
const common = require('../utils/common');
const { BANK_FIELD_TYPES, BANK_FIELD_OPTION_TYPES } = require('../constants/bankFieldConstants');
const { bankFieldDefinitionSchema, buildBankDetailValuesSchema } = require('../middlewares/validations/bankFieldTemplateValidations');

// Per-country bank detail fields (models/BankFieldTemplate.js) and a vendor's
// values for them (CompanySettings.bankDetails). Everything here works off
// the vendor's STORE country - see constants/bankFieldConstants.js.
//
// Templates are edited directly in the DB, so every field is checked here
// when it is read: a broken one (bad type, radio without options, invalid
// pattern, duplicate key, ...) is skipped and logged rather than breaking the
// form, the checkout or the invoice. Not cached - one small query per use,
// so a DB edit shows up at once.

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

// The template's usable fields: valid, active ('A'), unique keys, in display order.
const sanitizeTemplateFields = (rawFields, countryId) => {
    try {
        const fields = [];
        const seenKeys = new Set();
        (Array.isArray(rawFields) ? rawFields : []).forEach((rawField, index) => {
            const { error, value } = bankFieldDefinitionSchema.validate(rawField, {
                stripUnknown: true,
                errors: { wrap: { label: false } }
            });
            if (error) {
                logger.logWarning('Bank field template: a field is invalid and was skipped', {
                    additionalData: { countryId: String(countryId), index, key: rawField?.key, reason: error.message }
                });
                return;
            }
            const lowerKey = value.key.toLowerCase();
            if (seenKeys.has(lowerKey)) {
                logger.logWarning('Bank field template: a duplicate field key was skipped', {
                    additionalData: { countryId: String(countryId), index, key: value.key }
                });
                return;
            }
            seenKeys.add(lowerKey);
            if (value.status === 'A') fields.push(value);
        });
        return fields.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (err) {
        throw err;
    }
};

// { country: { _id, name } | null, fields: [] } - fields is empty when the
// country has no active template (or none of its fields is usable).
const fetchActiveFieldsForCountry = async (countryId) => {
    try {
        if (!countryId) return { country: null, fields: [] };
        const [country, template] = await Promise.all([
            CountryMaster.findById(countryId).select('country_name').lean(),
            BankFieldTemplate.findOne({ countryId, status: 'A' }).select('fields').lean()
        ]);
        return {
            country: country ? { _id: country._id, name: country.country_name } : null,
            fields: template ? sanitizeTemplateFields(template.fields, countryId) : []
        };
    } catch (err) {
        throw err;
    }
};

// For the admin form (Company Settings > Payment & Bank): the fields of a
// country - usually the store country, or the one just picked on the
// General tab before saving.
const getBankFieldsForCountry = async (countryId) => {
    try {
        const country = await CountryMaster.findOne({ _id: countryId, status: 'A' }).select('_id').lean();
        if (!country) {
            return common.returnResult(false, 404, 'The selected country is not available.');
        }
        const result = await fetchActiveFieldsForCountry(countryId);
        const message = result.fields.length > 0
            ? 'Bank fields fetched successfully'
            : `No bank fields are set up for ${result.country?.name || 'this country'} yet.`;
        return common.returnResult(true, 200, message, result);
    } catch (err) {
        throw err;
    }
};

// The vendor's saved values for one country as { key: value }.
const savedValuesForCountry = (bankDetails, countryId) => {
    try {
        const entry = (bankDetails || []).find((item) => sameId(item.countryId, countryId));
        return Object.fromEntries((entry?.values || []).map((item) => [item.key, item.value]));
    } catch (err) {
        throw err;
    }
};

const isEmptyValue = (value) => value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0);

// Checks the submitted values against the country's fields. Required fields
// are only enforced once at least one value is filled in - all empty means
// "no bank details" (cleared, or never used). Returns
// returnResult(true, 200, ..., { values }) with every field of the template
// present (empty = null, or [] for a checkbox), or the first failure.
const validateBankDetailValues = (fields, submittedValues) => {
    try {
        const values = submittedValues || {};
        const enforceRequired = Object.values(values).some((value) => !isEmptyValue(value));
        const { error, value } = buildBankDetailValuesSchema(fields, enforceRequired).validate(values, {
            abortEarly: false,
            errors: { wrap: { label: false } }
        });
        if (error) {
            // A field that isn't in the template (e.g. another country's) is the real problem - say that first.
            const detail = error.details.find((item) => item.type === 'object.unknown') || error.details[0];
            return common.returnResult(false, 400, detail.message.replace(/"/g, ''));
        }
        return common.returnResult(true, 200, 'Bank details are valid', { values: value });
    } catch (err) {
        throw err;
    }
};

// Has anything changed compared with what is saved for that country?
const haveValuesChanged = (fields, newValues, savedValues) => {
    try {
        const normalize = (value) => (isEmptyValue(value) ? null : JSON.stringify(value));
        return fields.some((field) => normalize(newValues[field.key]) !== normalize(savedValues[field.key]));
    } catch (err) {
        throw err;
    }
};

// Stores `values` for `countryId` in the bankDetails list, keeping every
// other country's values as they are (they come back if the store country is
// switched back). Values of keys no longer in the template are kept too.
const mergeCountryValues = (bankDetails, countryId, values) => {
    try {
        const list = (bankDetails || []).map((item) => ({
            countryId: item.countryId,
            values: (item.values || []).map((entry) => ({ key: entry.key, value: entry.value }))
        }));
        let entry = list.find((item) => sameId(item.countryId, countryId));
        if (!entry) {
            entry = { countryId, values: [] };
            list.push(entry);
        }
        Object.entries(values).forEach(([key, value]) => {
            const existing = entry.values.find((item) => item.key === key);
            if (existing) existing.value = value;
            else entry.values.push({ key, value });
        });
        return list;
    } catch (err) {
        throw err;
    }
};

// What a customer / the invoice sees for one value.
const displayValueOf = (field, value) => {
    try {
        if (isEmptyValue(value)) return null;
        if (BANK_FIELD_OPTION_TYPES.includes(field.type)) {
            const labelOf = (optionValue) => field.options.find((option) => option.value === optionValue)?.label || optionValue;
            return field.type === BANK_FIELD_TYPES.CHECKBOX
                ? [].concat(value).map(labelOf).join(', ')
                : labelOf(value);
        }
        return String(value);
    } catch (err) {
        throw err;
    }
};

// The vendor's bank details as the storefront and the invoice show them:
// [{ key, label, value }] for the filled-in fields of the store country, in
// display order - or null when there is nothing to show (no store country,
// no template for it, or nothing filled in).
// companySettingsData may be the cached (JSON) copy, so ids are compared as strings.
const resolveBankDetailsForDisplay = async (companySettingsData) => {
    try {
        const countryId = companySettingsData?.storeCountryId;
        if (!countryId) return null;
        const { fields } = await fetchActiveFieldsForCountry(countryId);
        if (fields.length === 0) return null;
        const saved = savedValuesForCountry(companySettingsData.bankDetails, countryId);
        const rows = fields
            .map((field) => ({ key: field.key, label: field.label, value: displayValueOf(field, saved[field.key]) }))
            .filter((row) => row.value);
        return rows.length > 0 ? rows : null;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    sanitizeTemplateFields,
    fetchActiveFieldsForCountry,
    getBankFieldsForCountry,
    savedValuesForCountry,
    validateBankDetailValues,
    haveValuesChanged,
    mergeCountryValues,
    resolveBankDetailsForDisplay
};
