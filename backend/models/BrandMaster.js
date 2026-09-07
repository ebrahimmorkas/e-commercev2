const mongoose = require('mongoose');

const brandMasterSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    brandName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    brandShortName: {
        type: String,
        trim: true,
        default: null,
        maxlength: 20
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

// Two different vendors may both create a brand named "Nike" - uniqueness is
// scoped per vendor, not global.
brandMasterSchema.index({ vendorId: 1, brandName: 1 }, { unique: true });

// Same scoping as brandName, but sparse - brandShortName is optional
// (default null), and sparse keeps the index from rejecting more than one
// brand per vendor with no short name set.
brandMasterSchema.index({ vendorId: 1, brandShortName: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('BrandMaster', brandMasterSchema);
