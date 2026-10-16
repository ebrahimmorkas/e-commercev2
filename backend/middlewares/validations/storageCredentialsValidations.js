const Joi = require('joi');

// Validates the PLAIN-TEXT storage credentials a vendor's CompanyMaster is
// given by seeds/seedCompanyMaster.js (there is no API for this - CompanyMaster
// is written straight to the DB, by the platform owner only). Run with
// abortEarly: false and NO stripUnknown, so a mistyped key is reported instead
// of being silently dropped.
//
// Shape (every area and every provider is optional, but a provider that is
// given must be complete):
//   {
//     image: { cloudinary: {...}, aws: {...}, r2: {...} },
//     video: { ... },
//     file:  { ... }
//   }

// Cloudinary: "cloud name" from the dashboard - lowercase letters, digits, - and _.
const cloudName = Joi.string().trim().lowercase().min(1).max(100).pattern(/^[a-z0-9_-]+$/).messages({
    'string.pattern.base': 'cloudName may only contain lowercase letters, digits, hyphens and underscores'
});
// Cloudinary API keys are numeric.
const cloudinaryApiKey = Joi.string().trim().min(6).max(32).pattern(/^\d+$/).messages({
    'string.pattern.base': 'apiKey must contain digits only'
});
const cloudinaryApiSecret = Joi.string().trim().min(10).max(128).pattern(/^[A-Za-z0-9_-]+$/).messages({
    'string.pattern.base': 'apiSecret may only contain letters, digits, hyphens and underscores'
});

// S3-style access keys (AWS and R2).
const accessKeyId = Joi.string().trim().min(16).max(128).pattern(/^[A-Za-z0-9]+$/).messages({
    'string.pattern.base': 'accessKeyId may only contain letters and digits'
});
const secretAccessKey = Joi.string().trim().min(20).max(256).pattern(/^[A-Za-z0-9/+=_-]+$/).messages({
    'string.pattern.base': 'secretAccessKey contains characters a secret access key cannot have'
});

// AWS bucket naming rules: 3-63 chars, lowercase letters/digits/dots/hyphens,
// starts and ends with a letter or digit, no "..", not an IP address.
const bucket = Joi.string().trim().min(3).max(63)
    .pattern(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'bucket')
    .pattern(/\.\./, { name: 'doubleDot', invert: true })
    .pattern(/^\d{1,3}(\.\d{1,3}){3}$/, { name: 'ipAddress', invert: true })
    .messages({
        'string.pattern.name': 'bucket must be a valid bucket name (3-63 lowercase letters, digits, dots or hyphens)',
        'string.pattern.invert.name': 'bucket must be a valid bucket name (no "..", not an IP address)'
    });

// e.g. ap-south-1, us-east-1, us-gov-west-1
const awsRegion = Joi.string().trim().lowercase().pattern(/^[a-z]{2}(-gov)?-[a-z]+-\d{1,2}$/).messages({
    'string.pattern.base': 'region must be a valid AWS region, e.g. ap-south-1'
});

// Cloudflare account ids are 32 hex characters.
const r2AccountId = Joi.string().trim().lowercase().pattern(/^[a-f0-9]{32}$/).messages({
    'string.pattern.base': 'accountId must be the 32-character Cloudflare account id'
});

// Base URLs are stored without a trailing slash, since keys are appended as "/<key>".
const httpsUrl = Joi.string().trim().max(500).uri({ scheme: ['https'] }).replace(/\/+$/, '').messages({
    'string.uriCustomScheme': '{#label} must be an https:// URL'
});

const cloudinaryCredentialsSchema = Joi.object({
    cloudName: cloudName.required(),
    apiKey: cloudinaryApiKey.required(),
    apiSecret: cloudinaryApiSecret.required()
});

const awsCredentialsSchema = Joi.object({
    accessKeyId: accessKeyId.required(),
    secretAccessKey: secretAccessKey.required(),
    region: awsRegion.required(),
    bucket: bucket.required()
});

const r2CredentialsSchema = Joi.object({
    accountId: r2AccountId.required(),
    accessKeyId: accessKeyId.required(),
    secretAccessKey: secretAccessKey.required(),
    bucket: bucket.required(),
    endpoint: httpsUrl.label('endpoint'),
    publicUrl: httpsUrl.label('publicUrl').required()
});

const storageAreaCredentialsSchema = Joi.object({
    cloudinary: cloudinaryCredentialsSchema,
    aws: awsCredentialsSchema,
    r2: r2CredentialsSchema
}).min(1).messages({
    'object.min': '{#label} must contain at least one provider (cloudinary, aws or r2)'
});

const storageCredentialsSchema = Joi.object({
    image: storageAreaCredentialsSchema,
    video: storageAreaCredentialsSchema,
    file: storageAreaCredentialsSchema
}).min(1).required().messages({
    'object.min': 'Storage credentials must contain at least one area (image, video or file)'
});

module.exports = {
    storageCredentialsSchema
};
