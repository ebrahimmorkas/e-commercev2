const mongoose = require("mongoose");
const { VALID_PAYMENT_GATEWAYS, VALID_PAYMENT_METHODS } = require('../constants/paymentGatewayConstants');

const orderStatusHistorySchema = new mongoose.Schema(
    {
        stepId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        stepCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        stepName: {
            type: String,
            required: true,
            trim: true
        },

        sequence: {
            type: Number,
            required: true,
            min: 1
        },

        startedAt: {
            type: Date,
            required: true,
            default: Date.now
        },

        completedAt: {
            type: Date,
            default: null
        },

        remarks: {
            type: String,
            trim: true,
            default: null
        },

        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        isManualUpdate: {
            type: Boolean,
            required: true,
            default: false
        }
    },
    {
        _id: true
    }
);

// Snapshot of the resolved Address document at order-creation time. Address
// is a user-owned, user-editable document - if we only kept
// shippingAddressId/billingAddressId, a later edit (or soft-delete) to that
// saved address would silently change how a past order's shipping details
// display. This mirrors the same reasoning Cart already applies to
// product/variant/size data.
const orderAddressSnapshotSchema = new mongoose.Schema(
    {
        addressName: { type: String, trim: true, default: null },
        roomNo: { type: String, trim: true, required: true },
        building: { type: String, trim: true, required: true },
        addressInWords: { type: String, trim: true, required: true },
        floor: { type: String, trim: true, default: null },
        countryName: { type: String, trim: true, required: true },
        stateName: { type: String, trim: true, required: true },
        cityName: { type: String, trim: true, required: true },
        pincode: { type: String, trim: true, required: true }
    },
    { _id: false }
);

const orderPaymentSchema = new mongoose.Schema(
    {
        method: {
            type: String,
            enum: VALID_PAYMENT_METHODS,
            trim: true,
            default: null
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "AUTHORIZED",
                "PAID",
                "FAILED",
                "PARTIALLY_REFUNDED",
                "REFUNDED"
            ],
            default: "PENDING",
            required: true
        },

        transactionId: {
            type: String,
            trim: true,
            default: null
        },

        gateway: {
            type: String,
            enum: VALID_PAYMENT_GATEWAYS,
            trim: true,
            default: null
        },

        amount: {
            type: Number,
            min: 0,
            default: 0
        },

        paidAt: {
            type: Date,
            default: null
        },

        refundedAmount: {
            type: Number,
            min: 0,
            default: 0
        },

        refundedAt: {
            type: Date,
            default: null
        }
    },
    {
        _id: false
    }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        cartId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cart",
            required: true,
            index: true
        },

        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        orderStepMasterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OrderStepMaster",
            required: true,
            index: true
        },

        currentStepId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        currentStepCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        currentStepName: {
            type: String,
            required: true,
            trim: true
        },

        currentStepSequence: {
            type: Number,
            required: true,
            min: 1
        },

        statusHistory: {
            type: [orderStatusHistorySchema],
            default: []
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        totalDiscountAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        totalTaxAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        totalFreeCashAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        shippingAmount: {
            type: Number,
            min: 0,
            default: 0
        },

        additionalCharges: {
            type: Number,
            min: 0,
            default: 0
        },

        grandTotal: {
            type: Number,
            required: true,
            min: 0
        },

        currencyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CurrencyMaster",
            required: true,
            index: true
        },

        // --- Currency snapshot ---
        // CurrencyMaster is a shared master that could be edited later
        // (symbol/decimal formatting) - snapshot the values actually used to
        // price this order so historical orders always render the same way.
        currencyCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxlength: 5
        },

        currencySymbol: {
            type: String,
            required: true,
            trim: true
        },

        currencySymbolPosition: {
            type: String,
            enum: ["PREFIX", "SUFFIX"],
            required: true
        },

        currencyDecimalPlaces: {
            type: Number,
            required: true,
            default: 2
        },

        shippingAddressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
            required: true,
            index: true
        },

        shippingAddressSnapshot: {
            type: orderAddressSnapshotSchema,
            required: true
        },

        billingAddressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
            default: null,
            index: true
        },

        billingAddressSnapshot: {
            type: orderAddressSnapshotSchema,
            default: null
        },

        // Set by admin. A deliveryAgent-role user may only move this order
        // from DISPATCHED to DELIVERED, and only when assigned to them (see
        // orderStepConstants.js + orderService.js).
        assignedDeliveryAgentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        deliveryAgentAssignedAt: {
            type: Date,
            default: null
        },

        payment: {
            type: orderPaymentSchema,
            required: true,
            default: () => ({})
        },

        shippingMethod: {
            type: String,
            trim: true,
            default: null
        },

        courierName: {
            type: String,
            trim: true,
            default: null
        },

        trackingNumber: {
            type: String,
            trim: true,
            default: null,
            index: true
        },

        estimatedDeliveryDate: {
            type: Date,
            default: null
        },

        shippedAt: {
            type: Date,
            default: null
        },

        deliveredAt: {
            type: Date,
            default: null
        },

        cancellationReason: {
            type: String,
            trim: true,
            default: null
        },

        cancellationRemarks: {
            type: String,
            trim: true,
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        },

        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        // --- Refund rollup ---
        // Detailed, per-request return/exchange data lives in OrderReturn/
        // OrderExchange (an order can have multiple separate requests over
        // time). These two are a denormalized aggregate - the running total
        // refunded across every approved OrderReturn/OrderExchange for this
        // order, and when the most recent one happened - kept in sync by
        // the approval service so order lists/dashboards don't need to
        // aggregate across the child collections on every read.
        refundAmount: {
            type: Number,
            min: 0,
            default: 0
        },

        refundedAt: {
            type: Date,
            default: null
        },

        orderPlacedAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        },

        remarks: {
            type: String,
            trim: true,
            default: null
        },

        status: {
            type: String,
            enum: ["I", "A", "D"],
            default: "A",
            required: true,
            index: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        activeMarkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        inActiveMarkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        activeMarkedDate: {
            type: Date,
            default: null
        },

        inactiveMarkedDate: {
            type: Date,
            default: null
        },

        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

orderSchema.index(
    { vendorId: 1, orderNumber: 1 },
    { unique: true }
);

orderSchema.index(
    { vendorId: 1, cartId: 1 },
    { unique: true }
);

orderSchema.index({
    vendorId: 1,
    userId: 1,
    createdAt: -1
});

orderSchema.index({
    vendorId: 1,
    currentStepCode: 1,
    createdAt: -1
});

module.exports = mongoose.model("Order", orderSchema);