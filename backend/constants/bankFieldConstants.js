// Per-country bank detail fields (models/BankFieldTemplate.js).
//
// The platform owner defines, per country, which fields a vendor fills in for
// its bank account (e.g. India: IFSC Code, UAE: IBAN). A vendor's form, the
// storefront's bank transfer details and the invoice all show the fields of
// the vendor's STORE country (CompanySettings.storeCountryId). No template for
// that country (or no store country) = no bank details anywhere.

// Kinds of input a bank field can be.
//   text / textarea / number - typed in
//   radio / dropdown         - exactly one of `options`
//   checkbox                 - any number of `options` (stored as a list)
const BANK_FIELD_TYPES = {
    TEXT: 'text',
    TEXTAREA: 'textarea',
    NUMBER: 'number',
    RADIO: 'radio',
    DROPDOWN: 'dropdown',
    CHECKBOX: 'checkbox'
};

// Types whose value must come from the field's `options`.
const BANK_FIELD_OPTION_TYPES = [BANK_FIELD_TYPES.RADIO, BANK_FIELD_TYPES.DROPDOWN, BANK_FIELD_TYPES.CHECKBOX];

// Types that take minLength / maxLength / pattern / isUppercase.
const BANK_FIELD_TEXT_TYPES = [BANK_FIELD_TYPES.TEXT, BANK_FIELD_TYPES.TEXTAREA];

// A field key: starts with a letter, letters/digits only. It is where the
// vendor's value is stored - never change it once vendors have values (change
// the label instead).
const BANK_FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;

const MAX_BANK_FIELDS_PER_COUNTRY = 30;
const BANK_FIELD_LABEL_MAX_LENGTH = 60;
const BANK_FIELD_PLACEHOLDER_MAX_LENGTH = 100;
const BANK_FIELD_PATTERN_MAX_LENGTH = 300;
const BANK_FIELD_PATTERN_MESSAGE_MAX_LENGTH = 200;
const BANK_FIELD_MAX_OPTIONS = 50;
const BANK_FIELD_OPTION_MAX_LENGTH = 100;
// Upper limit for any typed-in value, whatever the field's own maxLength says.
const BANK_FIELD_TEXT_MAX_LENGTH = 200;
const BANK_FIELD_TEXTAREA_MAX_LENGTH = 1000;

module.exports = {
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
};
