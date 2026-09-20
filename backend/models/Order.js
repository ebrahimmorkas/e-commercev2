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

// Per-item tax breakdown, frozen at order-creation time from the same
// TaxMaster lookups checkoutCart already performs (cartService.js) - a tax
// rate change (or the TaxMaster doc being retired) after the order is
// placed must never alter what a past order is shown to have charged.
const orderItemTaxSchema = new mongoose.Schema(
    {
        taxId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TaxMaster",
            required: true
        },
        taxName: {
            type: String,
            required: true,
            trim: true
        },
        taxRate: {
            type: Number,
            required: true,
            min: 0
        },
        taxAmount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

// One product/variant/size line item actually placed on this order (i.e.
// isCheckedOut:true on the source Cart at the moment of order creation).
// Snapshotted the same way shippingAddressSnapshot/currency fields are -
// name/sku/price/tax must keep showing exactly what the customer bought and
// was charged, even if the Product/variant/size/TaxMaster is later edited,
// deactivated, or deleted. Only the display image is intentionally NOT
// snapshotted here (see orderService.js's enrichment step) - purely
// cosmetic, so it is resolved live against the current Product instead.
const orderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true
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
        sku: { type: String, required: true, trim: true },

        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        // unitPrice * quantity, before tax.
        lineAmount: {
            type: Number,
            required: true,
            min: 0
        },

        taxBreakdown: {
            type: [orderItemTaxSchema],
            default: []
        },
        lineTaxAmount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        // Admin-placed orders only (see isPlacedByAdmin). The stock actually
        // taken off the size for this line - can be less than `quantity` when
        // the vendor allows out-of-stock adding and stock was clamped at 0.
        // Cancellation restores exactly this amount. null on normal orders,
        // which restore from the linked Cart instead.
        stockDeductedQuantity: {
            type: Number,
            min: 0,
            default: null
        }
    },
    { _id: false }
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

const walkInCustomerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
        phone: { type: String, required: true, trim: true, minlength: 10, maxlength: 14 },
        whatsapp: { type: String, trim: true, minlength: 10, maxlength: 14, default: null },
        email: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
        address: { type: String, trim: true, maxlength: 1000, default: null }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        // Absent on admin-placed orders - they are built straight from the
        // admin's payload and never touch a Cart.
        cartId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cart",
            required: function () { return !this.isPlacedByAdmin; },
            index: true
        },

        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
            index: true
        },

        // Absent on walk-in (cash counter) orders - see isWalkInCustomer.
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: function () { return !this.isWalkInCustomer; },
            default: null,
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

        // The actual products/variants/sizes placed on this order. Empty
        // only for orders created before this field existed - see
        // orderService.js's fetchOrderById legacy fallback.
        items: {
            type: [orderItemSchema],
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

        // How shippingAmount was arrived at, snapshotted at order time so a
        // later change to the vendor's shipping settings never rewrites how a
        // past order was priced. Null for orders that predate this field and
        // for admin-placed orders (their shipping is typed in manually).
        // isShippingPending: the vendor's method is CUSTOM (manual), so
        // shippingAmount is 0 until it's entered at order confirmation.
        shippingPriceBreakdown: {
            type: new mongoose.Schema({
                method: { type: String, default: null },
                customAmount: { type: Number, min: 0, default: 0 },
                companyAmount: { type: Number, min: 0, default: 0 },
                isShippingPending: { type: Boolean, default: false }
            }, { _id: false }),
            default: null
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

        // Required on normal orders. Admin-placed orders may carry a saved
        // address, a free-text address (adminEnteredAddress), or neither.
        shippingAddressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
            required: function () { return !this.isPlacedByAdmin; },
            default: null,
            index: true
        },

        shippingAddressSnapshot: {
            type: orderAddressSnapshotSchema,
            required: function () { return !this.isPlacedByAdmin; },
            default: undefined
        },

        // --- Admin placing order on behalf of a user ---
        isPlacedByAdmin: {
            type: Boolean,
            required: true,
            default: false,
            index: true
        },

        // Cash counter sale: the customer is not in the system. No User is
        // created - whatever the admin typed is kept here (name and phone are
        // always present, the rest are optional).
        isWalkInCustomer: {
            type: Boolean,
            required: true,
            default: false,
            index: true
        },

        walkInCustomer: {
            type: walkInCustomerSchema,
            default: undefined
        },

        placedByAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        // Fixed amount the admin knocked off, already subtracted from grandTotal.
        adminDiscountAmount: {
            type: Number,
            min: 0,
            default: 0
        },

        // Open-text delivery address typed by the admin (not tied to any
        // saved Address document).
        adminEnteredAddress: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null
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

// Partial so admin-placed orders (which have no cartId) don't all collide on
// a null value. NOTE: changing this index's options requires dropping the old
// vendorId_1_cartId_1 index once - see scripts/migrateOrderCartIdIndex.js.
orderSchema.index(
    { vendorId: 1, cartId: 1 },
    { unique: true, partialFilterExpression: { cartId: { $type: "objectId" } } }
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