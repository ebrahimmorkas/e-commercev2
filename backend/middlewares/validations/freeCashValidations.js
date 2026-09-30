const Joi = require('joi');
const { FREE_CASH_OPTIONS, GIVE_FREE_CASH_TO_CONFIG } = require('../../constants/freeCashConstants');
const { DEFAULT_DISCOUNT_TIMEZONE, DATE_ONLY_PATTERN, isValidTimezone } = require('../../utils/discountSchedule');

// Free Cash ids (own id, target user/group/category ids) are
// common.encodeId-encoded, never raw hex ObjectIds - loose opaque-string
// check, decoded via common.decodeId in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// The body is JSON, or multipart/form-data when an excel file is attached -
// then every value is a string ("true", "250") and a one-item array a plain
// string. Joi's conversion (and .single()) turns them back into real types.
const bool = () => Joi.boolean().truthy('true').falsy('false');

const optionsNeeding = (flag) => FREE_CASH_OPTIONS.filter((key) => GIVE_FREE_CASH_TO_CONFIG[key][flag]);

// Ids required (non-empty) for the targeting options that use them, dropped otherwise.
const idsFor = (flag, label, { required = true } = {}) => Joi.when('giveFreeCashTo', {
    is: Joi.valid(...optionsNeeding(flag)),
    then: required
        ? Joi.array().items(objectId()).single().min(1).max(200).unique().required().label(label)
        : Joi.array().items(objectId()).single().max(500).unique().label(label),
    otherwise: Joi.any().strip()
});

const dateOnly = (label) => Joi.string().trim().pattern(DATE_ONLY_PATTERN).label(label)
    .messages({ 'string.pattern.base': '{{#label}} must be a date in YYYY-MM-DD format.' });

const amount = (label) => Joi.number().precision(2).max(100000000).label(label);

const freeCashFieldsSchema = {
    freeCashName: Joi.string().trim().min(2).max(150).required().label('Free Cash name'),
    freeCashAmount: amount('Free Cash amount').greater(0).required(),
    // Blank = no per-order limit. Never more than the amount itself.
    maxCashUsagePerOrder: amount('Max usage per order').greater(0).empty('').allow(null).default(null)
        .when('freeCashAmount', { is: Joi.number().required(), then: Joi.number().max(Joi.ref('freeCashAmount')) })
        .messages({ 'number.max': 'Max usage per order cannot be more than the Free Cash amount.' }),
    giveFreeCashTo: Joi.string().valid(...FREE_CASH_OPTIONS).required().label('Give Free Cash to'),
    userGroupIds: idsFor('needsUserGroupIds', 'User group(s)'),
    mainCategoryIds: idsFor('needsMainCategoryIds', 'Main category/categories'),
    // Optional - left empty, the whole main category/categories qualify.
    subCategoryIds: idsFor('needsSubCategoryIds', 'Sub category/categories', { required: false }),
    // Whole calendar days in `timezone` (see utils/discountSchedule.js).
    startDate: dateOnly('Start date').required(),
    endDate: dateOnly('End date').required(),
    timezone: Joi.string().trim().empty('').default(DEFAULT_DISCOUNT_TIMEZONE).label('Timezone')
        .custom((value, helpers) => (isValidTimezone(value) ? value : helpers.error('timezone.invalid')))
        .messages({ 'timezone.invalid': '{{#label}} must be a valid IANA timezone, e.g. Asia/Kolkata.' }),
    validAbove: amount('Valid above amount').min(0).empty('').default(0),
    canBeUsedWithOtherDiscounts: bool().default(false).label('Can be used with other discounts'),
    remarks: Joi.string().trim().allow('').max(500).default('').label('Remarks'),
    // "Notify customers by email" checkbox - see promotionEmailService.
    notifyCustomers: bool().default(false).label('Notify customers by email')
};

const endNotBeforeStart = (value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
        return helpers.message('End date cannot be before start date.');
    }
    return value;
};

const createFreeCashSchema = Joi.object(freeCashFieldsSchema).custom(endNotBeforeStart);

// The edit form sends every field, but a partial update (e.g. only a new
// name) is still accepted - whatever is left out keeps its stored value.
const updateFreeCashSchema = Joi.object({
    ...freeCashFieldsSchema,
    freeCashName: freeCashFieldsSchema.freeCashName.optional(),
    freeCashAmount: amount('Free Cash amount').greater(0),
    // null or '' (a multipart null) = remove the limit; left out = keep it.
    maxCashUsagePerOrder: amount('Max usage per order').greater(0).allow(null, '')
        .when('freeCashAmount', { is: Joi.number().required(), then: Joi.number().max(Joi.ref('freeCashAmount')) })
        .messages({ 'number.max': 'Max usage per order cannot be more than the Free Cash amount.' }),
    giveFreeCashTo: Joi.string().valid(...FREE_CASH_OPTIONS).label('Give Free Cash to'),
    userGroupIds: Joi.when('giveFreeCashTo', { not: Joi.exist(), then: Joi.array().items(objectId()).single().min(1).unique(), otherwise: freeCashFieldsSchema.userGroupIds }),
    mainCategoryIds: Joi.when('giveFreeCashTo', { not: Joi.exist(), then: Joi.array().items(objectId()).single().min(1).unique(), otherwise: freeCashFieldsSchema.mainCategoryIds }),
    subCategoryIds: Joi.when('giveFreeCashTo', { not: Joi.exist(), then: Joi.array().items(objectId()).single().unique(), otherwise: freeCashFieldsSchema.subCategoryIds }),
    startDate: dateOnly('Start date'),
    endDate: dateOnly('End date'),
    timezone: Joi.string().trim().empty('').label('Timezone')
        .custom((value, helpers) => (isValidTimezone(value) ? value : helpers.error('timezone.invalid')))
        .messages({ 'timezone.invalid': '{{#label}} must be a valid IANA timezone, e.g. Asia/Kolkata.' }),
    validAbove: amount('Valid above amount').min(0).empty(''),
    canBeUsedWithOtherDiscounts: bool().label('Can be used with other discounts'),
    remarks: Joi.string().trim().allow('').max(500).label('Remarks'),
    status: Joi.string().valid('A', 'I').label('Status'),
    notifyCustomers: bool().default(false).label('Notify customers by email')
}).custom(endNotBeforeStart);

const freeCashIdParamSchema = Joi.object({
    id: objectId().required().label('Free Cash id')
});

// The admin never sees customer ids, so a customer is picked by email
// (matched within this store only, case-insensitively).
const revokeFreeCashForUserSchema = Joi.object({
    email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required().label('Customer email'),
    freeCashId: objectId().required().label('Free Cash id')
});

const revokeFreeCashForAllUsersSchema = Joi.object({
    freeCashId: objectId().required().label('Free Cash id')
});

const bulkUserEmailRowSchema = Joi.object({
    email: Joi.string().trim().email({ tlds: { allow: false } }).required().label('Email'),
    __rowNumber: Joi.number().optional()
}).unknown(false);

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkFreeCashStatusSchema = Joi.object({
    freeCashIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Free Cash IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status'),
    // Only used when activating - emails the customers again.
    notifyCustomers: Joi.boolean().default(false).label('Notify customers by email')
});

const bulkDeleteFreeCashSchema = Joi.object({
    freeCashIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Free Cash IDs')
});

module.exports = {
    createFreeCashSchema,
    updateFreeCashSchema,
    freeCashIdParamSchema,
    revokeFreeCashForUserSchema,
    revokeFreeCashForAllUsersSchema,
    bulkUserEmailRowSchema,
    bulkFreeCashStatusSchema,
    bulkDeleteFreeCashSchema
};
