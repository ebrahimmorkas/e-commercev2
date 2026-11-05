const mongoose = require('mongoose');

// A storefront blog post. status follows the project-wide convention:
//   'A' = Published (visible once publishedAt has passed - future dates are
//         "scheduled"), 'I' = Draft/hidden, 'D' = soft-deleted.
const blogSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 150,
        trim: true
    },
    // URL part of /blog/:slug - unique per vendor among live posts (partial
    // index below, so a deleted post doesn't reserve its slug forever).
    slug: {
        type: String,
        required: true,
        maxlength: 180,
        trim: true,
        lowercase: true
    },
    excerpt: {
        type: String,
        maxlength: 300,
        trim: true,
        default: ''
    },
    // HTML from the admin rich-text editor.
    content: {
        type: String,
        required: true,
        maxlength: 200000
    },
    coverImage: {
        type: String,
        default: null
    },
    coverImageAssetId: {
        type: mongoose.Types.ObjectId,
        ref: 'ImageAsset',
        default: null
    },
    category: {
        type: String,
        maxlength: 40,
        trim: true,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    authorName: {
        type: String,
        maxlength: 60,
        trim: true,
        default: ''
    },
    readTimeMinutes: {
        type: Number,
        min: 1,
        default: 1
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    metaTitle: {
        type: String,
        maxlength: 70,
        trim: true,
        default: ''
    },
    metaDescription: {
        type: String,
        maxlength: 170,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'I',
        required: true
    },
    publishedAt: {
        type: Date,
        default: null
    },
    createdBy: { type: mongoose.Types.ObjectId, index: true },
    updatedBy: { type: mongoose.Types.ObjectId, index: true },
    deletedBy: { type: mongoose.Types.ObjectId, index: true },
    activeMarkedBy: { type: mongoose.Types.ObjectId },
    inActiveMarkedBy: { type: mongoose.Types.ObjectId },
    activeMarkedDate: { type: Date, default: null },
    inactiveMarkedDate: { type: Date, default: null }
}, {
    timestamps: true
});

// Mongo partial indexes can't use $ne, hence $in (see Product's indexes).
blogSchema.index(
    { vendorId: 1, slug: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['A', 'I'] } } }
);
blogSchema.index({ vendorId: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
