const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
});

const orderIdParamSchema = Joi.object({
    orderId: objectId().required().label('Order ID')
});

const exchangeIdParamSchema = Joi.object({
    id: objectId().required().label('Exchange request ID')
});

// Exchange always needs an explicit requested replacement per item -
// there's no "auto" replacement the way whole-order return has.
const createExchangeRequestSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        productId: objectId().required().label('Product ID'),
        variantId: objectId().required().label('Variant ID'),
        sizeId: objectId().required().label('Size ID'),
        requestedProductId: objectId().required().label('Requested product ID'),
        requestedVariantId: objectId().required().label('Requested variant ID'),
        requestedSizeId: objectId().required().label('Requested size ID'),
        reason: Joi.string().trim().min(1).max(200).required().label('Reason'),
        reasonDescription: Joi.string().trim().max(500).allow(null, '').label('Reason description')
    })).min(1).required().label('Items')
});

const approveExchangeSchema = Joi.object({
    remarks: Joi.string().trim().max(500).allow(null, '').label('Remarks')
});

const rejectExchangeSchema = Joi.object({
    rejectionReason: Joi.string().trim().min(1).max(500).required().label('Rejection reason')
});

module.exports = {
    orderIdParamSchema,
    exchangeIdParamSchema,
    createExchangeRequestSchema,
    approveExchangeSchema,
    rejectExchangeSchema
};
