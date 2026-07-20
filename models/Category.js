const mongoose = require('mongoose');

const categorySchema = mongoose.Schema({
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
        type: String,
        required: false,
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    precedence: {
        type: Number,
        min: 1
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
        required: true,
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

module.exports = mongoose.model('Category', categorySchema);