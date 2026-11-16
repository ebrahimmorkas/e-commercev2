// Creates the per-country bank field templates (models/BankFieldTemplate.js)
// for India and the UAE. A country that already has a live template is left
// alone - after this, templates are maintained directly in the DB (see the
// example and field properties in models/BankFieldTemplate.js).
// Each template is checked with the same rules the app reads templates with
// before anything is saved.
//
// India's keys match the old fixed bank fields of CompanySettings, so
// scripts/migrateBankDetailsToCountryFields.js can move existing values over.
//
// Run:  node seeds/seedBankFieldTemplates.js
// Against another environment's DB, e.g. stage on Render:
//       node --env-file=.env.render seeds/seedBankFieldTemplates.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const BankFieldTemplate = require('../models/BankFieldTemplate');
const CountryMaster = require('../models/CountryMaster');
const { bankFieldTemplateFieldsSchema } = require('../middlewares/validations/bankFieldTemplateValidations');

const ACCOUNT_TYPE_OPTIONS = [
    { value: 'SAVINGS', label: 'Savings' },
    { value: 'CURRENT', label: 'Current' }
];

const SWIFT_FIELD = {
    key: 'swiftCode',
    label: 'SWIFT / BIC Code',
    type: 'text',
    isRequired: false,
    isUppercase: true,
    placeholder: 'e.g. ABCDAEAD or ABCDAEADXXX',
    minLength: 8,
    maxLength: 11,
    pattern: '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$',
    patternMessage: 'SWIFT / BIC Code must be 8 or 11 letters and digits (e.g. ABCDAEAD or ABCDAEADXXX).'
};

// short_country_name (CountryMaster) -> fields
const TEMPLATES = {
    IN: [
        { key: 'accountHolderName', label: 'Account Holder Name', type: 'text', isRequired: true, maxLength: 100, displayOrder: 1 },
        { key: 'bankName', label: 'Bank Name', type: 'text', isRequired: true, maxLength: 100, displayOrder: 2 },
        {
            key: 'accountNumber', label: 'Account Number', type: 'text', isRequired: true,
            placeholder: 'e.g. 012345678901', minLength: 9, maxLength: 18,
            pattern: '^[0-9]{9,18}$', patternMessage: 'Account Number must be 9 to 18 digits.',
            displayOrder: 3
        },
        {
            key: 'ifscCode', label: 'IFSC Code', type: 'text', isRequired: true, isUppercase: true,
            placeholder: 'e.g. ABCD0123456', minLength: 11, maxLength: 11,
            pattern: '^[A-Z]{4}0[A-Z0-9]{6}$', patternMessage: 'IFSC Code must be 4 letters, a 0, then 6 letters or digits (e.g. ABCD0123456).',
            displayOrder: 4
        },
        { key: 'branchName', label: 'Branch Name', type: 'text', isRequired: false, maxLength: 100, displayOrder: 5 },
        { ...SWIFT_FIELD, placeholder: 'e.g. ABCDINBB or ABCDINBBXXX', displayOrder: 6 },
        { key: 'accountType', label: 'Account Type', type: 'radio', isRequired: false, options: ACCOUNT_TYPE_OPTIONS, displayOrder: 7 }
    ],
    AE: [
        { key: 'accountHolderName', label: 'Account Holder Name', type: 'text', isRequired: true, maxLength: 100, displayOrder: 1 },
        { key: 'bankName', label: 'Bank Name', type: 'text', isRequired: true, maxLength: 100, displayOrder: 2 },
        {
            key: 'iban', label: 'IBAN', type: 'text', isRequired: true, isUppercase: true,
            placeholder: 'e.g. AE070331234567890123456', minLength: 23, maxLength: 23,
            pattern: '^AE[0-9]{21}$', patternMessage: 'IBAN must be AE followed by 21 digits, without spaces (e.g. AE070331234567890123456).',
            displayOrder: 3
        },
        { ...SWIFT_FIELD, displayOrder: 4 },
        { key: 'branchName', label: 'Branch Name', type: 'text', isRequired: false, maxLength: 100, displayOrder: 5 },
        { key: 'accountType', label: 'Account Type', type: 'radio', isRequired: false, options: ACCOUNT_TYPE_OPTIONS, displayOrder: 6 }
    ]
};

async function seedBankFieldTemplates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        for (const [shortName, rawFields] of Object.entries(TEMPLATES)) {
            const { error, value: fields } = bankFieldTemplateFieldsSchema.validate(rawFields, { errors: { wrap: { label: false } } });
            if (error) {
                throw new Error(`The ${shortName} template is invalid: ${error.message}`);
            }

            const country = await CountryMaster.findOne({ short_country_name: shortName, status: 'A' }).select('_id country_name').lean();
            if (!country) {
                console.log(`${shortName}: no active country with this short name - skipped.`);
                continue;
            }

            const existing = await BankFieldTemplate.findOne({ countryId: country._id, status: { $in: ['A', 'I'] } }).select('_id').lean();
            if (existing) {
                console.log(`${country.country_name}: a template already exists - left as it is.`);
                continue;
            }

            await BankFieldTemplate.create({ countryId: country._id, fields, status: 'A' });
            console.log(`${country.country_name}: template created with ${fields.length} fields (${fields.map((field) => field.label).join(', ')}).`);
        }
    } catch (err) {
        console.error('Seeding bank field templates failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedBankFieldTemplates();
