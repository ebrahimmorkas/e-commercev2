const mongoose = require("mongoose");

// One line item being exchanged. Full-line-quantity only (same rule as
// OrderReturn) - the customer swaps the entire quantity of this order line
// for the requested product/variant/size.
const orderExchangeItemSchema = new mongoose.Schema(
    {
        // The originally ordered line item being exchanged away.
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

        // What the customer wants instead - same product, different
        // variant/size in the common case, but not enforced as such since a
        // vendor may choose to allow cross-product exchanges.
        requestedProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        requestedVariantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        requestedSizeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        requestedProductName: { type: String, required: true, trim: true },
        requestedVariantName: { type: String, required: true, trim: true },
        requestedSizeName: { type: String, required: true, trim: true },
        requestedUnitPrice: { type: Number, required: true, min: 0 },

        // requestedUnitPrice - unitPrice. Positive = customer owes more,
        // negative = customer is owed a refund of the difference. Actual
        // collection/refund of this amount is deferred until payment
        // integration exists (same posture as Order.payment).
        priceDifference: { type: Number, required: true, default: 0 },

        reason: { type: String, required: true, trim: true },
        reasonDescription: { type: String, trim: true, default: null }
    },
    { _id: false }
);

const orderExchangeSchema = new mongoose.Schema(
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

        // Whether this request covers the whole order (fewItemsExchangeOnly
        // was off for this vendor at request time, auto-limited to whichever
        // items were still within their own product-level exchange window)
        // or a hand-picked subset the customer chose themselves.
        isWholeOrderExchange: {
            type: Boolean,
            required: true,
            default: false
        },

        items: {
            type: [orderExchangeItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "At least one item is required for an exchange request."
            }
        },

        totalPriceDifference: {
            type: Number,
            required: true,
            default: 0
        },

        exchangeStatus: {
            type: String,
            enum: ["REQUESTED", "APPROVED", "REJECTED", "PICKED_UP", "REPLACEMENT_SHIPPED", "COMPLETED", "CANCELLED"],
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

        replacementShippedAt: {
            type: Date,
            default: null
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

orderExchangeSchema.index({ vendorId: 1, orderId: 1 });
orderExchangeSchema.index({ vendorId: 1, userId: 1, createdAt: -1 });
orderExchangeSchema.index({ vendorId: 1, exchangeStatus: 1 });

module.exports = mongoose.model("OrderExchange", orderExchangeSchema);
