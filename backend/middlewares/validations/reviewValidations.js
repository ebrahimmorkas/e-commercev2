const Joi = require('joi');

const createReviewSchema = Joi.object({
  productId: Joi.string().trim().required(),
  variantId: Joi.string().trim().allow(null, '').optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().allow('').max(2000).optional(),
  images: Joi.array().items(Joi.string().uri()).max(5).optional()
});

const updateReviewSchema = Joi.object({
  reviewId: Joi.string().trim().required(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().trim().allow('').max(2000).optional(),
  images: Joi.array().items(Joi.string().uri()).max(5).optional()
}).min(2);

const listReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional()
});

module.exports = {
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema
};