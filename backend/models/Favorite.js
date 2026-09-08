const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    // Subdocument _id of the chosen variant inside Product.variants. A
    // favorite is never recorded at the product or variant level alone -
    // see sizeId below.
    variantId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    // Subdocument _id of the chosen size inside variant.sizes - the actual
    // sellable unit (price/stock/sku live here), so it's the only
    // granularity a favorite can be recorded at.
    sizeId: {
        type: mongoose.Types.ObjectId,
        required: true
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

// One ACTIVE favorite per exact size, per user, per vendor. Soft-deleted
// (status 'D') entries are excluded so removing then re-adding the same
// size doesn't collide - see addToFavorites in favoriteService.js, which
// reactivates the existing doc instead of creating a duplicate.
favoriteSchema.index(
    { vendorId: 1, userId: 1, productId: 1, variantId: 1, sizeId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'A' }
    }
);

favoriteSchema.index({ vendorId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('Favorite', favoriteSchema);
