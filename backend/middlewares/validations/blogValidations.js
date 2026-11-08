const Joi = require('joi');

// Blog ids are common.encodeId-encoded (see formatBlogForResponse in
// blogController), never a raw hex ObjectId - a loose opaque-string check.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// The add/update requests are multipart (cover image), so every field arrives
// as a string - Joi's default conversion turns 'true'/'false' and ISO dates
// into real booleans/Dates. `tags` is a comma-separated string.
const blogFields = {
    title: Joi.string().trim().min(3).max(150).label('Title'),
    slug: Joi.string().trim().lowercase().max(180).pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).allow('', null)
        .messages({ 'string.pattern.base': 'Slug may only contain lowercase letters, numbers and hyphens.' })
        .label('Slug'),
    excerpt: Joi.string().trim().max(300).allow('', null).label('Excerpt'),
    content: Joi.string().max(200000).label('Content'),
    category: Joi.string().trim().max(40).allow('', null).label('Category'),
    tags: Joi.string().trim().max(400).allow('', null).label('Tags'),
    authorName: Joi.string().trim().max(60).allow('', null).label('Author'),
    isFeatured: Joi.boolean().label('Featured'),
    metaTitle: Joi.string().trim().max(70).allow('', null).label('SEO title'),
    metaDescription: Joi.string().trim().max(170).allow('', null).label('SEO description'),
    status: Joi.string().valid('A', 'I').label('Status'),
    publishedAt: Joi.date().iso().allow('', null).label('Publish date'),
    removeCoverImage: Joi.boolean().label('Remove cover image')
};

const addBlogSchema = Joi.object({
    ...blogFields,
    title: blogFields.title.required(),
    content: blogFields.content.required()
});

const updateBlogSchema = Joi.object({
    blogId: objectId().required().label('Blog ID'),
    ...blogFields
});

const deleteBlogSchema = Joi.object({
    blogId: objectId().required().label('Blog ID')
});

const idParamSchema = Joi.object({
    id: objectId().required().label('Blog ID')
});

const slugParamSchema = Joi.object({
    slug: Joi.string().trim().lowercase().max(180).pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required().label('Slug')
});

const adminListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).allow('').default(''),
    status: Joi.string().valid('A', 'I').allow('')
});

const publicListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(24).default(9),
    search: Joi.string().trim().max(100).allow('').default(''),
    category: Joi.string().trim().max(40).allow('').default('')
});

const bulkBlogStatusSchema = Joi.object({
    blogIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Blog IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteBlogSchema = Joi.object({
    blogIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Blog IDs')
});

module.exports = {
    addBlogSchema,
    updateBlogSchema,
    deleteBlogSchema,
    idParamSchema,
    slugParamSchema,
    adminListQuerySchema,
    publicListQuerySchema,
    bulkBlogStatusSchema,
    bulkDeleteBlogSchema
};
