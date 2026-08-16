const Joi = require("joi");

const objectId = Joi.string().hex().length(24).message("must be a valid Mongo ObjectId");

// parent_category_id may legitimately arrive as an empty string / literal "null"
// when sent via multipart/form-data (all fields are strings), so treat those as null.
const normalizeParentId = (schema) =>
  schema.custom((value) => {
    if (value.parent_category_id === "" || value.parent_category_id === "null" || value.parent_category_id === undefined) {
      value.parent_category_id = null;
    }
    return value;
  });

const addCategorySchema = normalizeParentId(
  Joi.object({
    categoryName: Joi.string().trim().min(1).max(100).required(),
    parent_category_id: Joi.alternatives().try(objectId, Joi.string().valid("", "null")).allow(null).optional(),
    status: Joi.string().valid("A", "I").default("A"),
  })
);

// At least category_id plus one field to change.
const updateCategorySchema = normalizeParentId(
  Joi.object({
    category_id: objectId.required(),
    categoryName: Joi.string().trim().min(1).max(100),
    parent_category_id: Joi.alternatives().try(objectId, Joi.string().valid("", "null")).allow(null),
    status: Joi.string().valid("A", "I"),
  })
    .min(2)
    .messages({ "object.min": "At least one field must be provided to update, along with category_id" })
);

const deleteCategorySchema = Joi.object({
  category_id: objectId.required(),
});

const bulkCategoryRowSchema = Joi.object({
    categoryPath: Joi.string()
        .trim()
        .min(1)
        .max(1000)
        .empty(null)
        .required()
        .custom((value, helpers) => {
            const segments = value.split('>').map((s) => s.trim()).filter(Boolean);
            if (segments.length === 0) return helpers.error('any.invalid');
            for (const seg of segments) {
                if (seg.length > 100) return helpers.error('any.invalid');
            }
            return value;
        })
        .messages({
            'any.invalid': "categoryPath must contain valid, non-empty '>'-separated segments, each under 100 characters",
            'any.required': 'categoryPath is required'
        }),
    imagePath: Joi.string().trim().max(500).empty(null).empty('').optional(),
    status: Joi.string().trim().uppercase().empty(null).empty('').valid('A', 'I').default('A'),
    __rowNumber: Joi.number().optional()
}).unknown(false);

module.exports = {
  addCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  bulkCategoryRowSchema   
};