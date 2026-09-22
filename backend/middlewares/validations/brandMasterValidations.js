const Joi = require('joi');

// Brand ids are common.encodeId-encoded (see formatBrandForResponse in
// brandMasterController), never a raw hex ObjectId - so this is a loose
// opaque-string check, not a hex/length one. Decoded via common.decodeId in
// the controller before reaching the service.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

const addBrandSchema = Joi.object({
    brandName: Joi.string().trim().min(2).max(50).required().label('Brand name'),
    brandShortName: Joi.string().trim().min(1).max(20).allow('', null).label('Brand short name')
});

const updateBrandSchema = Joi.object({
    brandId: objectId().required().label('Brand ID'),
    brandName: Joi.string().trim().min(2).max(50).label('Brand name'),
    brandShortName: Joi.string().trim().min(1).max(20).allow('', null).label('Brand short name'),
    status: Joi.string().valid('A', 'I').label('Status')
}).or('brandName', 'brandShortName', 'status');

const deleteBrandSchema = Joi.object({
    brandId: objectId().required().label('Brand ID')
});

const idParamSchema = Joi.object({
    id: objectId().required().label('Brand ID')
});

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkBrandStatusSchema = Joi.object({
    brandIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Brand IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteBrandSchema = Joi.object({
    brandIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Brand IDs')
});

module.exports = {
    addBrandSchema,
    updateBrandSchema,
    deleteBrandSchema,
    idParamSchema,
    bulkBrandStatusSchema,
    bulkDeleteBrandSchema
};
