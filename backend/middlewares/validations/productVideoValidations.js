const Joi = require('joi');

// Product videos (see services/productVideoService.js). Ids are
// common.encodeId-encoded, like every other product id, so this is an opaque
// string check - the controller decodes it.

// POST /products/upload-product-video - the file itself (field "video") is
// checked by middlewares/productVideoUpload.js; no other fields are accepted
// (validate() strips anything else).
const uploadProductVideoSchema = Joi.object({});

// DELETE /products/product-video/:videoId
const productVideoIdParamSchema = Joi.object({
    videoId: Joi.string().trim().min(1).max(200).required()
        .messages({
            'string.empty': 'Video ID is required.',
            'any.required': 'Video ID is required.',
            'string.min': 'Video ID must be a valid id.',
            'string.max': 'Video ID must be a valid id.'
        })
        .label('Video ID')
});

module.exports = {
    uploadProductVideoSchema,
    productVideoIdParamSchema
};
