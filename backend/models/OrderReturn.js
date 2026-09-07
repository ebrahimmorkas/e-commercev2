const mongoose = require("mongoose");

// One line item being returned. Full-line-quantity only (confirmed
// decision - no partial-unit returns), so `quantity` here is a snapshot of
// how many units were on that order line for display/refund-calculation
// purposes, not a customer-editable value.
const orderReturnItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        sizeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        productName: { type: String, required: true, trim: true },
        variantName: { type: String, required: true, trim: true },
        sizeName: { type: String, required: true, trim: true },

        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },

        reason: { type: String, required: true, trim: true },
        reasonDescription: { type: String, trim: true, default: null }
    },
    { _id: false }
);

const orderReturnSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },

        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // Whether this request covers the whole order (fewItemsReturnOnly
        // was off for this vendor at request time, auto-limited to whichever
        // items were still within their own product-level return window) or
        // a hand-picked subset the customer chose themselves.
        isWholeOrderReturn: {
            type: Boolean,
            required: true,
            default: false
        },

        items: {
            type: [orderReturnItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "At least one item is required for a return request."
            }
        },

        totalRefundAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        returnStatus: {
            type: String,
            enum: ["REQUESTED", "APPROVED", "REJECTED", "PICKED_UP", "REFUNDED", "CANCELLED"],
            default: "REQUESTED",
            required: true,
            index: true
        },

        rejectionReason: {
            type: String,
            trim: true,
            default: null
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        approvedAt: {
            type: Date,
            default: null
        },

        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        rejectedAt: {
            type: Date,
            default: null
        },

        pickedUpAt: {
            type: Date,
            default: null
        },

        refundedAt: {
            type: Date,
            default: null
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
    },
    {
        timestamps: true
    }
);

orderReturnSchema.index({ vendorId: 1, orderId: 1 });
orderReturnSchema.index({ vendorId: 1, userId: 1, createdAt: -1 });
orderReturnSchema.index({ vendorId: 1, returnStatus: 1 });

module.exports = mongoose.model("OrderReturn", orderReturnSchema);
