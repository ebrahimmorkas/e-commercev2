const Joi = require('joi');

const bulkProductNameRowSchema = Joi.object({
  productName: Joi.string().trim().min(1).required().label('Product name'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

const bulkCategoryNameRowSchema = Joi.object({
  categoryName: Joi.string().trim().min(1).required().label('Category name'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

const bulkUserEmailRowSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().label('Email'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

module.exports = {
  bulkProductNameRowSchema,
  bulkCategoryNameRowSchema,
  bulkUserEmailRowSchema
};