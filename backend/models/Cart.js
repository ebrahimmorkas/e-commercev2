const mongoose = require("mongoose");

const cartSizeSchema = new mongoose.Schema(
    {
        sizeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SizeMaster",
            required: true
        },

        // --- Snapshot fields ---
        // Populated at add-to-cart time from Product/SizeMaster (so the cart
        // can render without re-joining Product on every fetch), and
        // re-verified + re-frozen at checkout time (price/name may have
        // drifted since it was added). "Snapshot" = frozen-and-trusted from
        // the moment it's written, not "empty until checkout".
        sizeName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },

        // Price of one unit of this exact size
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },

        // Exact inventory/SKU reference
        sku: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // True once this line item has successfully gone through checkout
        // pricing at least once. Items that failed checkout (e.g. out of
        // stock while allowOutOfStockProductsAdding is true) stay false and
        // remain in the cart untouched.
        isCheckedOut: {
            type: Boolean,
            default: false
        }
    },
    {
        _id: false
    }
);

const cartVariantSchema = new mongoose.Schema(
    {
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        variantName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },

        sizes: {
            type: [cartSizeSchema],
            required: true,

            validate: {
                validator: function (sizes) {
                    return Array.isArray(sizes) && sizes.length > 0;
                },
                message: "At least one size is required for a variant."
            }
        }
    },
    {
        _id: false
    }
);

const cartProductSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        productName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 200
        },

        variants: {
            type: [cartVariantSchema],
            required: true,

            validate: {
                validator: function (variants) {
                    return Array.isArray(variants) && variants.length > 0;
                },
                message: "At least one variant is required for a product."
            }
        }
    },
    {
        _id: false
    }
);

const cartDiscountSchema = new mongoose.Schema(
    {
        discountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Discount",
            required: true
        },

        // Snapshot of discount name at the time it is applied
        discountName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 200
        },

        // Actual amount discounted from the cart
        discountAmount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

const cartTaxSchema = new mongoose.Schema(
    {
        taxId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TaxMaster",
            required: true
        },

        // Snapshot of tax name
        taxName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },

        // Tax percentage/rate
        taxRate: {
            type: Number,
            required: true,
            min: 0
        },

        // Actual tax amount calculated for the cart
        taxAmount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

// Audit trail for items silently dropped from the cart (excluded location,
// went inactive/deleted, or bumped by numberOfProductsAllowedInCartAtOnce
// during a guest-cart merge). Kept on the Cart doc itself so support/admin
// can answer "why did my product disappear from my cart" after the fact.
const removedCartItemSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        variantName: { type: String },
        sizeId: { type: mongoose.Schema.Types.ObjectId, ref: "SizeMaster" },
        sizeName: { type: String },
        reason: {
            type: String,
            enum: ["EXCLUDED_LOCATION", "INACTIVE_STATUS", "CART_LIMIT_EXCEEDED"],
            required: true
        },
        // Human-readable sentence explaining exactly why, e.g.
        // "Removed because this size is not available for delivery in
        // Maharashtra." - shown to admin/support during audit.
        reasonText: {
            type: String,
            required: true
        },
        removedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

const cartSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            required: true,
            index: true
        },

        // Present for a logged-in user's cart. Absent (null) for a guest cart.
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        // Present for a guest cart (value = the guestCartId cookie, a UUID).
        // Absent (null) once the cart belongs to a logged-in user.
        guestId: {
            type: String,
            default: null,
            index: true
        },

        products: {
            type: [cartProductSchema],
            default: []
        },

        discounts: {
            type: [cartDiscountSchema],
            default: []
        },

        freeCashIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FreeCash"
            }
        ],

        taxes: {
            type: [cartTaxSchema],
            default: []
        },

        totalDiscountAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalTaxAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalFreeCashAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        removedItems: {
            type: [removedCartItemSchema],
            default: []
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
        inActiveMarkedBy: {
            type: mongoose.Schema.Types.ObjectId,
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
        },
        remarks: {
            type: String,
            default: null
        },

        status: {
            type: String,
            enum: ["I", "A", "D"],
            default: "A",
            required: true
        },

        checkedOutDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// A cart must belong to either a user or a guest, never both, never neither.
cartSchema.pre("validate", function () {
    const hasUser = !!this.userId;
    const hasGuest = !!this.guestId;

    if (hasUser === hasGuest) {
        throw new Error("A cart must belong to exactly one of userId or guestId.");
    }
});

// One active cart per logged-in user.
cartSchema.index(
    { userId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "A",
            userId: { $type: "objectId" }
        }
    }
);

// One active cart per guest.
cartSchema.index(
    { guestId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: "A",
            guestId: { $type: "string" }
        }
    }
);

cartSchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model("Cart", cartSchema);
