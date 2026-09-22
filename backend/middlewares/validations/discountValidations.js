const Joi = require('joi');

// Discount ids (own _id and the group-id arrays submitted directly by the
// client) are common.encodeId-encoded, never raw hex ObjectIds - loose
// opaque-string check, decoded via common.decodeId in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
  'string.min': '{{#label}} must be a valid id.',
});

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkDiscountStatusSchema = Joi.object({
  discountIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Discount IDs'),
  status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteDiscountSchema = Joi.object({
  discountIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Discount IDs')
});

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
  bulkUserEmailRowSchema,
  bulkDiscountStatusSchema,
  bulkDeleteDiscountSchema
};