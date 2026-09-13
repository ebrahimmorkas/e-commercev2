const Joi = require('joi');

const objectId = Joi.string().hex().length(24).message('must be a valid Mongo ObjectId');

// module/maxSizeField/allowedFormatsField/maxCountField are all field NAMES the
// calling module tells us to look up on companyMasterData (e.g. 'allowedProductVideoMB'),
// not the actual limits themselves - so they're validated as plain identifier strings.
const fieldNamePattern = /^[a-zA-Z][a-zA-Z0-9]*$/;

const uploadVideoSchema = Joi.object({
    module: Joi.string().trim().min(2).max(50).required(),
    maxSizeField: Joi.string().trim().pattern(fieldNamePattern).max(100).messages({
        'string.pattern.base': 'maxSizeField must be a valid field name (letters and digits only)',
    }),
    allowedFormatsField: Joi.string().trim().pattern(fieldNamePattern).max(100).messages({
        'string.pattern.base': 'allowedFormatsField must be a valid field name (letters and digits only)',
    }),
    maxCountField: Joi.string().trim().pattern(fieldNamePattern).max(100).messages({
        'string.pattern.base': 'maxCountField must be a valid field name (letters and digits only)',
    }),
});

// At least one field required for an update; everything else optional.
const updateVideoSchema = Joi.object({
    maxSizeField: Joi.string().trim().pattern(fieldNamePattern).max(100).messages({
        'string.pattern.base': 'maxSizeField must be a valid field name (letters and digits only)',
    }),
    allowedFormatsField: Joi.string().trim().pattern(fieldNamePattern).max(100).messages({
        'string.pattern.base': 'allowedFormatsField must be a valid field name (letters and digits only)',
    }),
});

const videoIdParamSchema = Joi.object({
    videoId: objectId.required(),
});

const getVideosQuerySchema = Joi.object({
    module: Joi.string().trim().min(2).max(50).required(),
});

module.exports = {
    uploadVideoSchema,
    updateVideoSchema,
    videoIdParamSchema,
    getVideosQuerySchema,
};
