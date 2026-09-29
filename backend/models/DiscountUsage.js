const mongoose = require("mongoose");

// One record per discount per order it was used on - what a customer's
// "how many times have I used this discount" (isDiscountReusable /
// discountReusableNumber) is counted from. Written when the order is placed
// (services/discountUsageService.js) and never removed: a cancelled order
// does not give the use back.
const discountUsageSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },

        discountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Discount",
            required: true,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        // Snapshot of the discount name when it was used
        discountName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },

        // Amount this discount took off the order, in the store currency
        discountAmount: {
            type: Number,
            required: true,
            min: 0
        },

        usedDate: {
            type: Date,
            required: true,
            default: Date.now
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
        inActiveMarkedBy: {
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
    },
    {
        timestamps: true
    }
);

discountUsageSchema.index({ vendorId: 1, discountId: 1, userId: 1 });

module.exports = mongoose.model("DiscountUsage", discountUsageSchema);
