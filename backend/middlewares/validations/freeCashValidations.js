const Joi = require('joi');
const { FREE_CASH_OPTIONS } = require('../../constants/freeCashConstants');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const objectIdArray = (label) => Joi.array().items(objectId()).label(label);

const freeCashFieldsSchema = {
    freeCashName: Joi.string().trim().min(2).max(150).required().label('Free Cash name'),
    freeCashAmount: Joi.number().min(0).required().label('Free Cash amount'),
    maxCashUsagePerOrder: Joi.number().min(0).allow(null).label('Max cash usage per order'),
    giveFreeCashTo: Joi.string().valid(...FREE_CASH_OPTIONS).required().label('Give Free Cash to'),
    userGroupIds: objectIdArray('User group(s)'),
    mainCategoryIds: objectIdArray('Main category/categories'),
    subCategoryIds: objectIdArray('Sub category/categories'),
    startDate: Joi.date().required().label('Start date'),
    endDate: Joi.date().greater(Joi.ref('startDate')).required().label('End date').messages({
        'date.greater': 'End date must be after start date.'
    }),
    validAbove: Joi.number().min(0).label('Valid above amount'),
    canBeUsedWithOtherDiscounts: Joi.boolean().label('Can be used with other discounts'),
    remarks: Joi.string().trim().allow('').max(500).label('Remarks')
};

const createFreeCashSchema = Joi.object(freeCashFieldsSchema);

// endDate has no startDate to compare against unless startDate is also sent
// in the same request, so the cross-field .greater() check only fires when
// both are present - the service re-validates ordering against the existing
// document's stored startDate when only one of the two is being changed.
const updateFreeCashSchema = Joi.object({
    freeCashName: freeCashFieldsSchema.freeCashName.optional(),
    freeCashAmount: freeCashFieldsSchema.freeCashAmount.optional(),
    maxCashUsagePerOrder: freeCashFieldsSchema.maxCashUsagePerOrder,
    giveFreeCashTo: freeCashFieldsSchema.giveFreeCashTo.optional(),
    userGroupIds: freeCashFieldsSchema.userGroupIds,
    mainCategoryIds: freeCashFieldsSchema.mainCategoryIds,
    subCategoryIds: freeCashFieldsSchema.subCategoryIds,
    startDate: Joi.date().label('Start date'),
    endDate: Joi.date().label('End date'),
    validAbove: freeCashFieldsSchema.validAbove,
    canBeUsedWithOtherDiscounts: freeCashFieldsSchema.canBeUsedWithOtherDiscounts,
    remarks: freeCashFieldsSchema.remarks,
    status: Joi.string().valid('A', 'I').label('Status')
});

const freeCashIdParamSchema = Joi.object({
    id: objectId().required().label('Free Cash id')
});

const revokeFreeCashForUserSchema = Joi.object({
    userId: objectId().required().label('User id'),
    freeCashId: objectId().required().label('Free Cash id')
});

const revokeFreeCashForAllUsersSchema = Joi.object({
    freeCashId: objectId().required().label('Free Cash id')
});

const bulkUserEmailRowSchema = Joi.object({
    email: Joi.string().trim().email({ tlds: { allow: false } }).required().label('Email'),
    __rowNumber: Joi.number().optional()
}).unknown(false);

module.exports = {
    createFreeCashSchema,
    updateFreeCashSchema,
    freeCashIdParamSchema,
    revokeFreeCashForUserSchema,
    revokeFreeCashForAllUsersSchema,
    bulkUserEmailRowSchema
};
