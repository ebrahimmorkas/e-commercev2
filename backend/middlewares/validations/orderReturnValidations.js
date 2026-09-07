const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const orderIdParamSchema = Joi.object({
    orderId: objectId().required().label('Order ID')
});

const returnIdParamSchema = Joi.object({
    id: objectId().required().label('Return request ID')
});

// Item selection is only required when the vendor's fewItemsReturnOnly is
// on - reason/reasonDescription at the top level cover the whole-order
// case, validated at the service layer against the live setting.
const createReturnRequestSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        productId: objectId().required().label('Product ID'),
        variantId: objectId().required().label('Variant ID'),
        sizeId: objectId().required().label('Size ID'),
        reason: Joi.string().trim().min(1).max(200).required().label('Reason'),
        reasonDescription: Joi.string().trim().max(500).allow(null, '').label('Reason description')
    })),
    reason: Joi.string().trim().min(1).max(200).label('Reason'),
    reasonDescription: Joi.string().trim().max(500).allow(null, '').label('Reason description')
});

const approveReturnSchema = Joi.object({
    remarks: Joi.string().trim().max(500).allow(null, '').label('Remarks')
});

const rejectReturnSchema = Joi.object({
    rejectionReason: Joi.string().trim().min(1).max(500).required().label('Rejection reason')
});

module.exports = {
    orderIdParamSchema,
    returnIdParamSchema,
    createReturnRequestSchema,
    approveReturnSchema,
    rejectReturnSchema
};
