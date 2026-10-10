const mongoose = require("mongoose");
const { VALID_REVOKE_ACTIONS } = require('../constants/freeCashUsageConstants');

const cashUsageHistorySchema = new mongoose.Schema(
    {
        amountUsed: {
            type: Number,
            required: true,
            min: 0
        },

        remainingAmount: {
            type: Number,
            required: true,
            min: 0
        },

        usedDate: {
            type: Date,
            required: true
        },

        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
        }
    },
    {
        _id: true
    }
);

const cashRefundHistorySchema = new mongoose.Schema(
    {
        amountRefunded: {
            type: Number,
            required: true,
            min: 0
        },

        // Snapshot of remainingAmount immediately after this refund was applied
        remainingAmount: {
            type: Number,
            required: true,
            min: 0
        },

        refundedDate: {
            type: Date,
            required: true
        },

        orderReturnId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OrderReturn",
            required: true
        }
    },
    {
        _id: true
    }
);

// One revoke, or one restore after a revoke (the customer was put back on the
// campaign's list). isRevoked/revokedBy/revokedDate below only hold the
// latest state - this keeps every one, for the Free Cash Usage history.
const revokeHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: VALID_REVOKE_ACTIONS,
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        by: {
            type: mongoose.Types.ObjectId,
            default: null
        }
    },
    {
        _id: true
    }
);

const userFreeCashSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Types.ObjectId,
            required: true,
            index: true
        },

        freeCashId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FreeCash",
            required: true,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        usedAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        remainingAmount: {
            type: Number,
            required: true,
            min: 0
        },

        issuedDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        isCashUsed: {
            type: Boolean,
            default: false
        },

        isCashExpired: {
            type: Boolean,
            default: false
        },

        cashExpiredDate: {
            type: Date,
            default: null
        },

        // Set by an admin explicitly revoking this grant (gated by
        // websiteMaster/companyMaster isRevokingFreeCashFunctionalityAllowed /
        // isRevokingAllUsersFreeCashFunctionalityAllowed) - distinct from
        // isCashExpired, which is time/stacking driven and never set by a
        // direct admin action.
        isRevoked: {
            type: Boolean,
            default: false
        },
        revokedBy: {
            type: mongoose.Types.ObjectId,
            default: null,
            index: true
        },
        revokedDate: {
            type: Date,
            default: null
        },

        cashUsageHistory: {
            type: [cashUsageHistorySchema],
            default: []
        },

        cashRefundHistory: {
            type: [cashRefundHistorySchema],
            default: []
        },

        revokeHistory: {
            type: [revokeHistorySchema],
            default: []
        },

        // When this customer got the "Free Cash Expiring Soon" email for this
        // grant - sent once (see services/expiryReminderService.js).
        expiryReminderSentAt: {
            type: Date,
            default: null
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

userFreeCashSchema.index({ vendorId: 1, userId: 1, isCashExpired: 1, isRevoked: 1 });
userFreeCashSchema.index({ vendorId: 1, freeCashId: 1 });

// One grant per customer per campaign, ever - a used-up, expired or revoked
// grant still counts. This is what makes the lazy cart-time issue (and the
// same email twice in an excel) unable to hand out the same Free Cash twice.
// Run scripts/migrateUserFreeCashUniqueIndex.js once on an existing database.
userFreeCashSchema.index({ vendorId: 1, freeCashId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("UserFreeCash", userFreeCashSchema);
