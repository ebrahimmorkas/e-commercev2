const mongoose = require('mongoose');

const imageAssetSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },

    // Which calling module this image belongs to, e.g. 'banner', 'category', 'companyLogo'.
    // Kept as a free string (not enum) since more modules will be added over time.
    module: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Which storage provider actually holds this file right now.
    provider: {
        type: String,
        enum: ['cloudinary', 'aws', 'r2', 'local'],
        required: true
    },

    // Public URL to access the image.
    url: {
        type: String,
        required: true
    },

    // Provider-specific identifier needed to delete/replace the file later
    // (Cloudinary publicId, S3/R2 object key, or local relative file path).
    key: {
        type: String,
        required: true
    },

    originalName: {
        type: String
    },

    mimeType: {
        type: String
    },

    size: {
        // size in bytes
        type: Number
    },

    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkeddBy: {
        type: mongoose.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
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

module.exports = mongoose.model('ImageAsset', imageAssetSchema);