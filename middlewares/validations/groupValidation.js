const Joi = require('joi');

const GROUP_TYPES = ["PRODUCT", "CATEGORY", "USER", "BRAND", "TAG", "ORDER", "CUSTOM"];

// members are opaque encoded ID strings (see common.encodeId/decodeId), not
// raw ObjectIds, so we validate them as non-empty strings rather than hex.
const memberIdSchema = Joi.string().trim().min(1);

const createGroupSchema = Joi.object({
  groupType: Joi.string().valid(...GROUP_TYPES).required(),
  groupName: Joi.string().trim().min(1).max(120).required(),
  slug: Joi.string().trim().lowercase().max(160).optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  members: Joi.array().items(memberIdSchema).min(1).required(),
  precedence: Joi.number().integer().min(0).optional(),
  remarks: Joi.string().trim().allow('').max(500).optional(),
});

const updateGroupSchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
  groupType: Joi.string().valid(...GROUP_TYPES).optional(),
  groupName: Joi.string().trim().min(1).max(120).optional(),
  slug: Joi.string().trim().lowercase().max(160).optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  members: Joi.array().items(memberIdSchema).min(1).optional(),
  precedence: Joi.number().integer().min(0).optional(),
  remarks: Joi.string().trim().allow('').max(500).optional(),
});

// Used for delete / activate / deactivate - body only carries the id.
const groupIdBodySchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
});

// Used for GET /:id
const groupIdParamSchema = Joi.object({
  id: Joi.string().trim().min(1).required(),
});

// Used for GET / (list) query filters
const listGroupsQuerySchema = Joi.object({
  groupType: Joi.string().valid(...GROUP_TYPES).optional(),
});

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  groupIdBodySchema,
  groupIdParamSchema,
  listGroupsQuerySchema,
};