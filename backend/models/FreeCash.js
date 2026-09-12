const mongoose = require("mongoose");

const freeCashSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },

        freeCashName: {
            type: String,
            required: true,
            trim: true
        },

        freeCashAmount: {
            type: Number,
            required: true,
            min: 0
        },

        maxCashUsagePerOrder: {
            type: Number,
            default: null,
            min: 0
        },

        // Mirrors Discount's giveDiscountTo - which of the 5 targeting modes
        // (companyMaster.freeCashOptions is the allow-list for these) this
        // campaign uses. Drives which of the fields below get populated -
        // see GIVE_FREE_CASH_TO_CONFIG in constants/freeCashConstants.js.
        giveFreeCashTo: {
            type: String,
            enum: ['ALL_USERS', 'SPECIFIC_USERS', 'ONLY_MAIN_CATEGORY', 'MAIN_CATEGORY_AND_SUB_CATEGORY', 'GROUPS'],
            required: true
        },

        // Resolved snapshot of the actual target users - populated from the
        // uploaded excel (SPECIFIC_USERS) or from the combined/deduped
        // members of userGroupIds (GROUPS) at create/update time. Empty for
        // ALL_USERS / ONLY_MAIN_CATEGORY / MAIN_CATEGORY_AND_SUB_CATEGORY,
        // since those are not user-targeted.
        giveToUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        // Only used when giveFreeCashTo === 'GROUPS'. Multiple groups may be
        // selected at once; only Group documents with groupType 'USER' are
        // valid here.
        userGroupIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Group"
            }
        ],

        // Only used when giveFreeCashTo is 'ONLY_MAIN_CATEGORY' or
        // 'MAIN_CATEGORY_AND_SUB_CATEGORY'. Multiple main categories may be
        // selected, same convention as Discount.categoryIds.
        mainCategoryIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category"
            }
        ],

        // Only used when giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY'.
        // Each entry must be a Category whose parent_category_id is one of
        // mainCategoryIds. Empty here (with mainCategoryIds set) means the
        // free cash is eligible on every product under the selected main
        // category/categories, nested or not.
        subCategoryIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category"
            }
        ],

        // true whenever giveFreeCashTo is not category-restricted
        // (ALL_USERS / SPECIFIC_USERS / GROUPS) - system-managed, derived
        // from giveFreeCashTo, not accepted directly from the payload.
        applicableToAllProducts: {
            type: Boolean,
            default: true
        },

        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            required: true
        },

        // Minimum cart/order subtotal required before this free cash can be
        // applied. See canBeUsedWithOtherDiscounts below for how this
        // interacts with a Discount's own discountValidAboveAmount.
        validAbove: {
            type: Number,
            default: 0,
            min: 0
        },

        // When true, a discount and this free cash may both be applied to
        // the same order. Each one's own minimum-amount requirement
        // (validAbove here, discountValidAboveAmount on Discount) is checked
        // against the cart total AT THE MOMENT it is applied - so whichever
        // is applied second is checked against the total AFTER the first
        // one's deduction, not the original subtotal. This is enforced in
        // the cart/order service, not here.
        canBeUsedWithOtherDiscounts: {
            type: Boolean,
            default: false
        },

        remarks: {
            type: String,
            trim: true,
            default: ""
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
    },
    {
        timestamps: true
    }
);

freeCashSchema.index({ vendorId: 1, status: 1 });
freeCashSchema.index({ vendorId: 1, startDate: 1, endDate: 1 });
freeCashSchema.index({ vendorId: 1, giveFreeCashTo: 1 });
freeCashSchema.index({ vendorId: 1, giveToUsers: 1 });
freeCashSchema.index({ vendorId: 1, userGroupIds: 1 });
freeCashSchema.index({ vendorId: 1, mainCategoryIds: 1 });
freeCashSchema.index({ vendorId: 1, subCategoryIds: 1 });
freeCashSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model("FreeCash", freeCashSchema);
