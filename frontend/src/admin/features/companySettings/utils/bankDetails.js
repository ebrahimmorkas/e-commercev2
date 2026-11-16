/**
 * Per-country bank details (Company Settings > Payment & Bank). The fields
 * come from the store country's template (useBankFields); the draft keeps the
 * vendor's values per country in draft.bankDetailsByCountry
 * ({ [countryId]: { [fieldKey]: value } }), so switching the store country
 * back and forth never loses what was typed or saved.
 *
 * The rules below mirror backend middlewares/validations/
 * bankFieldTemplateValidations.js (the backend checks again on save).
 */

export const BANK_FIELD_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  RADIO: 'radio',
  DROPDOWN: 'dropdown',
  CHECKBOX: 'checkbox',
};

const isEmpty = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** The draft's values for one country ({} when none). */
export const bankValuesFor = (draft, countryId) => (countryId && draft.bankDetailsByCountry?.[countryId]) || {};

/**
 * Field errors as { [fieldKey]: message }. Required fields only count once
 * any bank detail is filled in - all empty means "no bank details".
 */
export const validateBankValues = (fields, values) => {
  const errors = {};
  const anyFilled = fields.some((field) => !isEmpty(values[field.key]));
  fields.forEach((field) => {
    const value = values[field.key];
    if (isEmpty(value)) {
      if (anyFilled && field.isRequired) errors[field.key] = `${field.label} is required.`;
      return;
    }
    if (field.type === BANK_FIELD_TYPES.TEXT || field.type === BANK_FIELD_TYPES.TEXTAREA) {
      const text = field.isUppercase ? String(value).trim().toUpperCase() : String(value).trim();
      const formatMessage = field.patternMessage;
      if (field.minLength && text.length < field.minLength) {
        errors[field.key] = formatMessage || `${field.label} must be at least ${field.minLength} characters.`;
      } else if (field.maxLength && text.length > field.maxLength) {
        errors[field.key] = formatMessage || `${field.label} must be at most ${field.maxLength} characters.`;
      } else if (field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(text)) errors[field.key] = formatMessage || `${field.label} is not in the right format.`;
        } catch {
          // An unusable pattern is the backend's to report.
        }
      }
    } else if (field.type === BANK_FIELD_TYPES.NUMBER) {
      const number = Number(value);
      if (Number.isNaN(number)) errors[field.key] = `${field.label} must be a number.`;
      else if (field.min != null && number < field.min) errors[field.key] = `${field.label} must be ${field.min} or more.`;
      else if (field.max != null && number > field.max) errors[field.key] = `${field.label} must be ${field.max} or less.`;
    }
  });
  return errors;
};

/**
 * The bankDetails save field: { countryId, values } as a JSON string (the
 * save is multipart). Only the keys of the country's fields are sent - the
 * backend rejects anything else.
 */
export const buildBankDetailsField = (fields, values, countryId) => {
  const sent = {};
  fields.forEach((field) => {
    const value = values[field.key];
    if (field.type === BANK_FIELD_TYPES.CHECKBOX) sent[field.key] = Array.isArray(value) ? value : [];
    else sent[field.key] = isEmpty(value) ? null : value;
  });
  return JSON.stringify({ countryId, values: sent });
};

/** API bankDetails ([{ countryId, values }]) -> { [countryId]: values }. */
export const mapBankDetailsToDraft = (bankDetails) =>
  Object.fromEntries((Array.isArray(bankDetails) ? bankDetails : []).map((entry) => [String(entry.countryId), { ...(entry.values || {}) }]));
