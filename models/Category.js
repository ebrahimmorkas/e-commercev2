const mongoose = require('mongoose');

const categorySchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    categoryName: {
        type: String,
        required: true,
        trim: true,
    },
    parent_category_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        required: false,
        ref: 'Category',
    },
    image: {
        url: {
            type: String,
            default: null
        },
        publicId: {
            type: String,
            default: null
        }
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
    actveMarkeddBy: {
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
    timestamps: true,
});

categorySchema.index({ parent_category_id: 1 });
categorySchema.index({ vendorId: 1, parent_category_id: 1 });
categorySchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model('Category', categorySchema);