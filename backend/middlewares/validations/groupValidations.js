const Joi = require('joi');

const GROUP_TYPES = ["PRODUCT", "CATEGORY", "USER", "BRAND", "ORDER", "CUSTOM"];

// members are common.encodeId-encoded ids of the referenced collection
// (Product/Category/User/Brand/Order), same as Group's own _id - every one
// of those collections' own endpoints encodes its ids too as of this
// rollout, so this is a loose opaque-string check, not hex/length(24).
// Decoded via common.decodeId in the controller before reaching the service.
const memberIdSchema = Joi.string().trim().min(1);

// members is optional at the Joi level (rather than required) because an
// excel-driven create/update omits it entirely - groupService enforces that
// at least one member ends up resolved, from either members or the excel file.
const createGroupSchema = Joi.object({
  groupType: Joi.string().valid(...GROUP_TYPES).required(),
  groupName: Joi.string().trim().min(1).max(120).required(),
  slug: Joi.string().trim().lowercase().max(160).optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  members: Joi.array().items(memberIdSchema).min(1).optional(),
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

// Row-level schemas for the excel-upload member picker (PRODUCT/CATEGORY/USER
// groupTypes only) - mirrors discountValidations.js's bulk*RowSchema convention.
const bulkGroupProductNameRowSchema = Joi.object({
  productName: Joi.string().trim().min(1).required().label('Product name'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

// subCategory is optional and, when present, may itself be a ">"-separated
// chain of nested names (e.g. "Mathematics>Algebra") - see
// groupService.resolveCategoryPath. Whether it's allowed at all depends on
// companyMaster.isNestingCategoryAllowedInGroup, checked in the service.
const bulkGroupCategoryNameRowSchema = Joi.object({
  categoryName: Joi.string().trim().min(1).required().label('Category name'),
  subCategory: Joi.string().trim().allow('').optional().label('Sub category'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

const bulkGroupUserEmailRowSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().label('Email'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

// --- Bulk status / delete (multi-select checkbox actions) --------------------
// Group's own _id is common.encodeId-encoded (see formatGroupForResponse in
// groupController), never a raw hex ObjectId - so these ids are loose
// strings, same as groupIdBodySchema/groupIdParamSchema above, and get
// decoded via common.decodeId in the controller before reaching the service.
const bulkGroupStatusSchema = Joi.object({
  groupIds: Joi.array().items(Joi.string().trim().min(1)).min(1).max(50).unique().required().label('Group IDs'),
  status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteGroupSchema = Joi.object({
  groupIds: Joi.array().items(Joi.string().trim().min(1)).min(1).max(50).unique().required().label('Group IDs')
});

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  groupIdBodySchema,
  groupIdParamSchema,
  listGroupsQuerySchema,
  bulkGroupProductNameRowSchema,
  bulkGroupCategoryNameRowSchema,
  bulkGroupUserEmailRowSchema,
  bulkGroupStatusSchema,
  bulkDeleteGroupSchema,
};