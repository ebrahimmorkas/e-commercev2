const mongoose = require('mongoose');
const { VALID_COMMISSION_LEDGER_STATUSES, COMMISSION_LEDGER_STATUSES } = require('../constants/commissionConstants');

// One row per order, created only when CompanyMaster.isCommissionFeatureOn
// is true for that vendor at the time the order was placed - see
// recordCommissionForOrder in commissionService.js. Purely a bookkeeping
// ledger of what the platform is owed; it does not move any money itself -
// the vendor's own gateway account still receives 100% of the payment.
const commissionLedgerEntrySchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    // Snapshot for display without populating Order.
    orderNumber: {
        type: String,
        required: true,
        trim: true
    },
    // Order.subtotal - Order.totalDiscountAmount at the time of recording -
    // net product revenue the commission is calculated on (excludes tax,
    // shipping and additional charges, which aren't the vendor's product
    // earnings).
    commissionBaseAmount: {
        type: Number,
        required: true,
        min: 0
    },
    // Snapshot of CompanyMaster.commissionPercentage at the time this entry
    // was created - a later change to the vendor's rate must not silently
    // rewrite what past orders owed.
    commissionPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    commissionAmount: {
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
    ledgerStatus: {
        type: String,
        enum: VALID_COMMISSION_LEDGER_STATUSES,
        default: COMMISSION_LEDGER_STATUSES.PENDING,
        required: true
    },
    collectedAt: {
        type: Date,
        default: null
    },
    // Admin's own reference for how it was collected (e.g. a bank transfer
    // reference, an invoice number) - free text, never parsed.
    collectedNotes: {
        type: String,
        trim: true,
        default: null
    },
    voidedAt: {
        type: Date,
        default: null
    },
    voidReason: {
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

commissionLedgerEntrySchema.index({ vendorId: 1, orderId: 1 }, { unique: true });
commissionLedgerEntrySchema.index({ vendorId: 1, ledgerStatus: 1, createdAt: -1 });

module.exports = mongoose.model('CommissionLedgerEntry', commissionLedgerEntrySchema);
