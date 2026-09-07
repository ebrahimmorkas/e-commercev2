const Joi = require('joi');

const objectId = () => Joi.string().hex().length(24).messages({
    'string.hex': '{{#label}} must be a valid id.',
    'string.length': '{{#label}} must be a valid id.'
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

module.exports = {
    addBrandSchema,
    updateBrandSchema,
    deleteBrandSchema,
    idParamSchema
};
