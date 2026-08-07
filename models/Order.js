const mongoose = require('mongoose');

/**
 * PLACEHOLDER MODEL.
 * Order.js doesn't exist in the codebase yet. This is the minimal shape
 * needed for reviewService.verifyPurchase() to check that a user actually
 * bought the product before letting them review it.
 *
 * TODO when the real Order model is built:
 *  - Merge/replace this file, but keep these fields (or equivalents) so
 *    reviewService's verification query keeps working:
 *      vendorId, userId, productId, variantId, orderStatus
 *  - Replace the orderStatus enum with the real order lifecycle
 *    (e.g. 'placed','confirmed','shipped','delivered','cancelled','returned').
 *    Only whatever the real "successfully delivered" status is should count
 *    as a verified purchase in reviewService.verifyPurchase().
 */
const orderSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    // TODO: replace with real order lifecycle enum
    orderStatus: {
        type: String,
        enum: ['placed', 'delivered', 'cancelled'],
        default: 'placed'
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, index: true },
    inActiveMarkeddBy: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    activeMarkedBy: { type: mongoose.Schema.Types.ObjectId, index: true },
    activeMarkedDate: { type: Date, default: null },
    inactiveMarkedDate: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);