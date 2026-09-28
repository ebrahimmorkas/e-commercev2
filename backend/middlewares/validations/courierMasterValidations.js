const Joi = require('joi');

// Courier ids are common.encodeId-encoded (see formatCourierForResponse in
// courierMasterController), never a raw hex ObjectId - so this is a loose
// opaque-string check. Decoded via common.decodeId in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// Mirrors CourierMaster.courierName (required, trimmed, 2-100 characters).
const courierName = () => Joi.string().trim().min(2).max(100).label('Courier name');

const addCourierSchema = Joi.object({
    courierName: courierName().required()
});

const updateCourierSchema = Joi.object({
    courierId: objectId().required().label('Courier ID'),
    courierName: courierName(),
    status: Joi.string().valid('A', 'I').label('Status')
}).or('courierName', 'status');

const deleteCourierSchema = Joi.object({
    courierId: objectId().required().label('Courier ID')
});

const idParamSchema = Joi.object({
    id: objectId().required().label('Courier ID')
});

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkCourierStatusSchema = Joi.object({
    courierIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Courier IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteCourierSchema = Joi.object({
    courierIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Courier IDs')
});

module.exports = {
    addCourierSchema,
    updateCourierSchema,
    deleteCourierSchema,
    idParamSchema,
    bulkCourierStatusSchema,
    bulkDeleteCourierSchema
};
