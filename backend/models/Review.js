const mongoose = require('mongoose');

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
    // Optional: which variant (subdocument _id within Product.variants) the
    // reviewer actually purchased, when known from the order. Reviews are
    // not required to be tied to a specific variant.
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // The order used to validate that this user actually purchased the
    // product/variant before allowing the review to be created. Required
    // since reviews are only permitted for verified purchases (see
    // isVerifiedPurchase below), and it's part of the unique index.
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        trim: true
    },
    images: {
        type: [String],
        default: []
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    },
    remarks: {
        type: String,
        enum: ['Deleted By User', 'Deleted By Admin'],
        default: 'Deleted By User'
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
    inActiveMarkeddBy: {
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

// A user can leave one review per order (so a repurchase of the same
// product allows a fresh review). orderId is required for this to be
// enforced meaningfully — the service layer should always set it.
reviewSchema.index({ vendorId: 1, productId: 1, userId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
