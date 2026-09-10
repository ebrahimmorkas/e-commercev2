const mongoose = require('mongoose');
const { VALID_PAYMENT_GATEWAYS, VALID_PAYMENT_METHODS, VALID_PAYMENT_TRANSACTION_STATUSES, PAYMENT_TRANSACTION_STATUSES } = require('../constants/paymentGatewayConstants');

// One document per payment attempt (not per order) - a customer retrying a
// failed/abandoned online payment produces a new transaction with a new
// gatewayReferenceId, never a mutation of the old one. This is what lets
// handleGatewayCallback (paymentService.js) verify a callback server-side
// and stay idempotent if the gateway redelivers the same IPN.
const paymentTransactionSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    gateway: {
        type: String,
        enum: VALID_PAYMENT_GATEWAYS,
        required: true
    },
    method: {
        type: String,
        enum: VALID_PAYMENT_METHODS,
        required: true
    },
    // Our own generated reference, sent to the gateway as cart_id (PayTabs)
    // and used to look the transaction back up when the callback arrives.
    gatewayReferenceId: {
        type: String,
        required: true,
        trim: true
    },
    // The gateway's own reference for this attempt (PayTabs tran_ref) - null
    // until the create-session call returns one.
    gatewayTransactionRef: {
        type: String,
        trim: true,
        default: null,
        index: true
    },
    transactionStatus: {
        type: String,
        enum: VALID_PAYMENT_TRANSACTION_STATUSES,
        default: PAYMENT_TRANSACTION_STATUSES.INITIATED,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currencyCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    redirectUrl: {
        type: String,
        trim: true,
        default: null
    },
    rawInitiateResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    rawCallbackResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    failureReason: {
        type: String,
        trim: true,
        default: null
    },

    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
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

paymentTransactionSchema.index({ vendorId: 1, gatewayReferenceId: 1 }, { unique: true });
paymentTransactionSchema.index({ vendorId: 1, orderId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
