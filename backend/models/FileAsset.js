const mongoose = require('mongoose');

// A stored non-image-only file (documents, spreadsheets, videos, images sent
// as plain attachments, ...) - the file counterpart of ImageAsset. Uploaded
// through services/fileUploadService.js to the vendor's file storage
// provider (CompanyMaster.fileService / WebsiteMaster.mainFileService).
const fileAssetSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },

    // Which calling module this file belongs to, e.g. 'emailAttachment'.
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

    // Public URL to access the file.
    url: {
        type: String,
        required: true
    },

    // Provider-specific identifier needed to delete the file later
    // (Cloudinary publicId, S3/R2 object key, or local relative file path).
    key: {
        type: String,
        required: true
    },

    originalName: {
        type: String
    },

    // Verified from the file's content where the format has a signature
    // (see validateFileContent in fileUploadService.js).
    mimeType: {
        type: String
    },

    // Lower-case extension without the dot, e.g. 'pdf'.
    extension: {
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
    inActiveMarkedBy: {
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

fileAssetSchema.index({ vendorId: 1, module: 1, status: 1 });

module.exports = mongoose.model('FileAsset', fileAssetSchema);
