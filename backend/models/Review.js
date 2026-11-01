const mongoose = require('mongoose');
const {
    REVIEW_TITLE_MAX_LENGTH,
    REVIEW_COMMENT_MAX_LENGTH,
    MAX_REVIEW_IMAGES_HARD_LIMIT,
    VALID_REVIEW_DELETE_REMARKS,
    REVIEW_MODERATION_STATUSES,
    VALID_REVIEW_MODERATION_STATUSES,
    VALID_REVIEW_HISTORY_ACTIONS,
    REVIEW_REJECTION_REASON_MAX_LENGTH
} = require('../constants/reviewConstants');

// One photo on a review. imageAssetId points at the ImageAsset row (module
// 'review') so the file can be removed from the vendor's storage account
// when the customer takes the photo off the review.
const reviewImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        trim: true
    },
    imageAssetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ImageAsset',
        default: null
    }
}, { _id: true });

// A full copy of a review's content - used for the published version, the
// customer's original submission and the before/after of every history entry.
const reviewContentSchema = new mongoose.Schema({
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    title: {
        type: String,
        trim: true,
        maxlength: REVIEW_TITLE_MAX_LENGTH,
        default: ''
    },
    comment: {
        type: String,
        trim: true,
        maxlength: REVIEW_COMMENT_MAX_LENGTH,
        default: ''
    },
    images: {
        type: [reviewImageSchema],
        default: []
    }
}, { _id: false });

// One change to a review: who did what, when, and the content before/after.
const reviewHistorySchema = new mongoose.Schema({
    action: {
        type: String,
        enum: VALID_REVIEW_HISTORY_ACTIONS,
        required: true
    },
    by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    byRole: {
        type: String,
        enum: ['user', 'admin', 'system'],
        required: true
    },
    at: {
        type: Date,
        default: Date.now
    },
    before: {
        type: reviewContentSchema,
        default: null
    },
    after: {
        type: reviewContentSchema,
        default: null
    },
    // Rejection reason (admin only - never shown to the customer).
    reason: {
        type: String,
        trim: true,
        maxlength: REVIEW_REJECTION_REASON_MAX_LENGTH,
        default: null
    }
}, { _id: true });

const reviewSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    // The delivered order this review is a verified purchase of. Reviews are
    // only allowed for delivered orders, and one order gives at most one
    // review per product (see the unique index below).
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    // What the customer actually bought, copied from that order's item so the
    // review keeps showing "Colour: Red | Size: M" even if the product is
    // later edited. When the order holds the product in more than one
    // variant/size, the first matching item is used.
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    variantName: {
        type: String,
        trim: true,
        default: null
    },
    sizeName: {
        type: String,
        trim: true,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'Rating must be a whole number from 1 to 5.'
        }
    },
    title: {
        type: String,
        trim: true,
        maxlength: REVIEW_TITLE_MAX_LENGTH,
        default: ''
    },
    comment: {
        type: String,
        trim: true,
        maxlength: REVIEW_COMMENT_MAX_LENGTH,
        default: ''
    },
    images: {
        type: [reviewImageSchema],
        default: [],
        validate: {
            validator: (images) => images.length <= MAX_REVIEW_IMAGES_HARD_LIMIT,
            message: `A review can have at most ${MAX_REVIEW_IMAGES_HARD_LIMIT} photos.`
        }
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: true
    },

    // ---- Moderation ------------------------------------------------------
    // rating/title/comment/images above are the CURRENT content - what the
    // customer sees as their own review and what the admin edits.
    // publishedContent is what every other shopper sees; null = not public
    // (a new review waiting for approval, or rejected). The product rating
    // and the storefront list only ever use publishedContent.
    moderationStatus: {
        type: String,
        enum: VALID_REVIEW_MODERATION_STATUSES,
        default: REVIEW_MODERATION_STATUSES.APPROVED,
        index: true
    },
    publishedContent: {
        type: reviewContentSchema,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    // The customer's first submission, exactly as written - never changed.
    originalContent: {
        type: reviewContentSchema,
        default: null
    },
    // Last approve/reject by the admin.
    moderatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    moderatedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: REVIEW_REJECTION_REASON_MAX_LENGTH,
        default: null
    },
    // Last admin edit (the full trail is in history).
    isEditedByAdmin: {
        type: Boolean,
        default: false
    },
    adminEditedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    adminEditedAt: {
        type: Date,
        default: null
    },
    history: {
        type: [reviewHistorySchema],
        default: []
    },
    // Why the review was deleted - set only when status becomes 'D'.
    remarks: {
        type: String,
        enum: [...VALID_REVIEW_DELETE_REMARKS, null],
        default: null
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    inActiveMarkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    activeMarkedDate: {
        type: Date,
        default: null
    },
    inactiveMarkedDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// One live review per product per order. Partial (status A/I only) so a
// deleted review doesn't stop the customer writing a fresh one for the same
// order. Mongo partial indexes can't use $ne, hence $in. Mongoose won't
// change an existing index's options - run scripts/migrateReviewFeature.js.
reviewSchema.index(
    { vendorId: 1, productId: 1, userId: 1, orderId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['A', 'I'] } }, name: 'uniq_live_review_per_order' }
);

// Storefront list (published reviews only, newest first or by star rating).
reviewSchema.index({ vendorId: 1, productId: 1, status: 1, 'publishedContent.rating': -1, createdAt: -1 });
// Admin list (pending first) and the "settle pending reviews" check.
reviewSchema.index({ vendorId: 1, status: 1, moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
