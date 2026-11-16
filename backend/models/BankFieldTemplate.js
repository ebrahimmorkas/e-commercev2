const mongoose = require('mongoose');
const {
    BANK_FIELD_TYPES,
    BANK_FIELD_KEY_PATTERN,
    BANK_FIELD_LABEL_MAX_LENGTH,
    BANK_FIELD_PLACEHOLDER_MAX_LENGTH,
    BANK_FIELD_PATTERN_MAX_LENGTH,
    BANK_FIELD_PATTERN_MESSAGE_MAX_LENGTH,
    BANK_FIELD_OPTION_MAX_LENGTH
} = require('../constants/bankFieldConstants');

// The bank detail fields of ONE country (see constants/bankFieldConstants.js).
// Platform-wide, like ModuleMaster / CountryMaster - so, deliberately, no
// vendorId: every vendor whose store country is this country fills in these
// fields. One live (A/I) template per country.
//
// Maintained directly in the DB by the platform owner, so Mongoose validation
// does NOT run on those edits. bankFieldTemplateService checks every field
// when it reads a template and skips (and logs) a broken one.
// No Redis caching - a DB edit shows up on the next request.
//
// Example document (MongoDB shell / Compass):
// {
//   countryId: ObjectId('<CountryMaster _id of United Arab Emirates>'),
//   status: 'A',
//   fields: [
//     { key: 'accountHolderName', label: 'Account Holder Name', type: 'text', isRequired: true,
//       maxLength: 100, displayOrder: 1, status: 'A' },
//     { key: 'iban', label: 'IBAN', type: 'text', isRequired: true, isUppercase: true,
//       placeholder: 'e.g. AE070331234567890123456', minLength: 23, maxLength: 23,
//       pattern: '^AE[0-9]{21}$', patternMessage: 'IBAN must be AE followed by 21 digits.',
//       displayOrder: 3, status: 'A' },
//     { key: 'accountType', label: 'Account Type', type: 'radio', isRequired: false,
//       options: [{ value: 'SAVINGS', label: 'Savings' }, { value: 'CURRENT', label: 'Current' }],
//       displayOrder: 6, status: 'A' }
//   ]
// }
// Field properties:
//   key            - letters/digits, starts with a letter, unique in the template.
//                    The vendor's value is stored under it: NEVER change it once
//                    vendors have values (change the label instead).
//   label          - what the vendor, the customer and the invoice see.
//   type           - text | textarea | number | radio | dropdown | checkbox
//   isRequired     - must be filled whenever the vendor fills in any bank detail.
//   placeholder    - hint inside an empty text/textarea/number box.
//   minLength / maxLength - text/textarea only.
//   min / max      - number only.
//   pattern        - text/textarea only: a regular expression the whole value must
//                    match (write it without the surrounding / /). patternMessage
//                    is the error shown when it doesn't.
//   isUppercase    - text/textarea only: the value is saved in capitals.
//   options        - radio/dropdown/checkbox only: [{ value, label }].
//   displayOrder   - smallest first.
//   status         - 'A' shown, 'I' hidden (values are kept).
const bankFieldOptionSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true,
        trim: true,
        maxlength: BANK_FIELD_OPTION_MAX_LENGTH
    },
    label: {
        type: String,
        required: true,
        trim: true,
        maxlength: BANK_FIELD_OPTION_MAX_LENGTH
    }
}, { _id: false });

const bankFieldSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        trim: true,
        match: BANK_FIELD_KEY_PATTERN
    },
    label: {
        type: String,
        required: true,
        trim: true,
        maxlength: BANK_FIELD_LABEL_MAX_LENGTH
    },
    type: {
        type: String,
        enum: Object.values(BANK_FIELD_TYPES),
        default: BANK_FIELD_TYPES.TEXT,
        required: true
    },
    isRequired: {
        type: Boolean,
        default: false
    },
    placeholder: {
        type: String,
        trim: true,
        maxlength: BANK_FIELD_PLACEHOLDER_MAX_LENGTH,
        default: null
    },
    minLength: {
        type: Number,
        min: 0,
        default: null
    },
    maxLength: {
        type: Number,
        min: 1,
        default: null
    },
    min: {
        type: Number,
        default: null
    },
    max: {
        type: Number,
        default: null
    },
    pattern: {
        type: String,
        maxlength: BANK_FIELD_PATTERN_MAX_LENGTH,
        default: null
    },
    patternMessage: {
        type: String,
        trim: true,
        maxlength: BANK_FIELD_PATTERN_MESSAGE_MAX_LENGTH,
        default: null
    },
    isUppercase: {
        type: Boolean,
        default: false
    },
    options: {
        type: [bankFieldOptionSchema],
        default: []
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['A', 'I'],
        default: 'A'
    }
}, { _id: false });

const bankFieldTemplateSchema = new mongoose.Schema({
    countryId: {
        type: mongoose.Types.ObjectId,
        ref: 'CountryMaster',
        required: true
        // Indexed by the unique partial index below.
    },
    fields: {
        type: [bankFieldSchema],
        default: []
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkedBy: {
        type: mongoose.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    activeMarkedDate: {
        type: Date,
        default: null
    },
    inactiveMarkedDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// One live template per country; a deleted one doesn't block a new one.
// (Partial indexes can't use $ne, hence $in.)
bankFieldTemplateSchema.index(
    { countryId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['A', 'I'] } }, name: 'countryId_live_unique' }
);

module.exports = mongoose.model('BankFieldTemplate', bankFieldTemplateSchema);
