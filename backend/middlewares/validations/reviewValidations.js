const Joi = require('joi');
const {
    REVIEW_TITLE_MAX_LENGTH,
    REVIEW_COMMENT_MAX_LENGTH,
    MAX_REVIEW_IMAGES_HARD_LIMIT,
    VALID_REVIEW_SORTS,
    MAX_REVIEW_PAGE_SIZE,
    VALID_ADMIN_REVIEW_FILTER_STATUSES,
    VALID_ADMIN_REVIEW_SORTS,
    MAX_ADMIN_REVIEW_PAGE_SIZE,
    MAX_BULK_REVIEW_IDS,
    REVIEW_REJECTION_REASON_MAX_LENGTH,
    ADMIN_REVIEW_SEARCH_MAX_LENGTH
} = require('../../constants/reviewConstants');

// Product/order/review ids reach the storefront encoded (common.encodeId), so
// they are opaque base64url strings here - the controller decodes and
// checks them. Raw-hex checks would reject every valid id.
const encodedId = (label) =>
    Joi.string().trim().max(200).pattern(/^[A-Za-z0-9_-]+$/)
        .label(label)
        .messages({
            'string.empty': `${label} is required.`,
            'string.pattern.base': `${label} is not valid.`,
            'string.max': `${label} is not valid.`
        });

// Star rating. Multipart forms send it as text ("4"), which Joi converts.
const rating = () =>
    Joi.number().integer().min(1).max(5)
        .label('Rating')
        .messages({
            'number.base': 'Choose a star rating from 1 to 5.',
            'number.integer': 'The star rating must be a whole number from 1 to 5.',
            'number.min': 'Choose a star rating from 1 to 5.',
            'number.max': 'Choose a star rating from 1 to 5.'
        });

const title = () =>
    Joi.string().trim().allow('').max(REVIEW_TITLE_MAX_LENGTH)
        .label('Review title')
        .messages({ 'string.max': `The review title can be at most ${REVIEW_TITLE_MAX_LENGTH} characters.` });

const comment = () =>
    Joi.string().trim().allow('').max(REVIEW_COMMENT_MAX_LENGTH)
        .label('Review')
        .messages({ 'string.max': `The review can be at most ${REVIEW_COMMENT_MAX_LENGTH} characters.` });

// Fields arrive as multipart form fields (photos are the `images` files).
const createReviewSchema = Joi.object({
    productId: encodedId('Product').required(),
    orderId: encodedId('Order').required(),
    rating: rating().required().messages({ 'any.required': 'Choose a star rating from 1 to 5.' }),
    title: title(),
    comment: comment()
});

// At least one change: a field, a photo to remove, or new photos (checked
// in the controller, since files are not part of the body).
const updateReviewSchema = Joi.object({
    reviewId: encodedId('Review').required(),
    rating: rating(),
    title: title(),
    comment: comment(),
    // Ids of the review's own photos (Review.images[]._id) to take off.
    // A single value from a form arrives as a plain string.
    removeImageIds: Joi.array()
        .items(Joi.string().trim().hex().length(24).messages({ 'string.hex': 'A photo to remove is not valid.', 'string.length': 'A photo to remove is not valid.' }))
        .single()
        .unique()
        .max(MAX_REVIEW_IMAGES_HARD_LIMIT)
        .label('Photos to remove')
});

const reviewIdBodySchema = Joi.object({
    reviewId: encodedId('Review').required()
});

const productIdParamSchema = Joi.object({
    productId: encodedId('Product').required()
});

const orderIdParamSchema = Joi.object({
    orderId: encodedId('Order').required()
});

const reviewIdParamSchema = Joi.object({
    reviewId: encodedId('Review').required()
});

const listReviewsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).max(100000).label('Page'),
    limit: Joi.number().integer().min(1).max(MAX_REVIEW_PAGE_SIZE).label('Limit'),
    sort: Joi.string().trim().valid(...VALID_REVIEW_SORTS).label('Sort')
        .messages({ 'any.only': `Sort must be one of: ${VALID_REVIEW_SORTS.join(', ')}.` }),
    // Show only reviews with this many stars.
    rating: Joi.number().integer().min(1).max(5).label('Star filter')
        .messages({ 'number.min': 'Star filter must be from 1 to 5.', 'number.max': 'Star filter must be from 1 to 5.' })
});

// ---------------------------------------------------------------------------
// Admin Reviews module
// ---------------------------------------------------------------------------

const adminListReviewsQuerySchema = Joi.object({
    status: Joi.string().trim().valid(...VALID_ADMIN_REVIEW_FILTER_STATUSES).label('Status')
        .messages({ 'any.only': `Status must be one of: ${VALID_ADMIN_REVIEW_FILTER_STATUSES.join(', ')}.` }),
    search: Joi.string().trim().allow('').max(ADMIN_REVIEW_SEARCH_MAX_LENGTH).label('Search')
        .messages({ 'string.max': `Search can be at most ${ADMIN_REVIEW_SEARCH_MAX_LENGTH} characters.` }),
    productId: encodedId('Product').allow(''),
    rating: Joi.number().integer().min(1).max(5).label('Star rating')
        .messages({ 'number.min': 'Star rating must be from 1 to 5.', 'number.max': 'Star rating must be from 1 to 5.' }),
    fromDate: Joi.date().iso().label('From date').messages({ 'date.format': 'From date must be a valid date.', 'date.base': 'From date must be a valid date.' }),
    toDate: Joi.date().iso().min(Joi.ref('fromDate')).label('To date')
        .messages({ 'date.format': 'To date must be a valid date.', 'date.base': 'To date must be a valid date.', 'date.min': 'To date cannot be before the from date.' }),
    sort: Joi.string().trim().valid(...VALID_ADMIN_REVIEW_SORTS).label('Sort')
        .messages({ 'any.only': `Sort must be one of: ${VALID_ADMIN_REVIEW_SORTS.join(', ')}.` }),
    page: Joi.number().integer().min(1).max(100000).label('Page'),
    limit: Joi.number().integer().min(1).max(MAX_ADMIN_REVIEW_PAGE_SIZE).label('Limit')
});

const reviewIdsBodySchema = Joi.object({
    reviewIds: Joi.array().items(encodedId('Review')).min(1).max(MAX_BULK_REVIEW_IDS).unique().required()
        .label('Reviews')
        .messages({
            'array.min': 'Select at least one review.',
            'array.max': `You can select at most ${MAX_BULK_REVIEW_IDS} reviews at once.`,
            'array.unique': 'The same review was selected twice.',
            'any.required': 'Select at least one review.'
        })
});

const rejectReviewsSchema = reviewIdsBodySchema.keys({
    // Optional, kept for the admin only - the customer is never told.
    reason: Joi.string().trim().allow('').max(REVIEW_REJECTION_REASON_MAX_LENGTH).label('Reason')
        .messages({ 'string.max': `The reason can be at most ${REVIEW_REJECTION_REASON_MAX_LENGTH} characters.` })
});

// Multipart (new photos are the `images` files).
const adminUpdateReviewSchema = Joi.object({
    reviewId: encodedId('Review').required(),
    rating: rating(),
    title: title(),
    comment: comment(),
    removeImageIds: Joi.array()
        .items(Joi.string().trim().hex().length(24).messages({ 'string.hex': 'A photo to remove is not valid.', 'string.length': 'A photo to remove is not valid.' }))
        .single()
        .unique()
        .max(MAX_REVIEW_IMAGES_HARD_LIMIT)
        .label('Photos to remove'),
    // "Save & approve".
    approve: Joi.boolean().truthy('true', '1').falsy('false', '0').label('Approve')
});

module.exports = {
    adminListReviewsQuerySchema,
    reviewIdsBodySchema,
    rejectReviewsSchema,
    adminUpdateReviewSchema,
    createReviewSchema,
    updateReviewSchema,
    reviewIdBodySchema,
    productIdParamSchema,
    orderIdParamSchema,
    reviewIdParamSchema,
    listReviewsQuerySchema
};
