const mongoose = require('mongoose');
const { OTP_RECORD_RETENTION_SECONDS } = require('../constants/forgotPasswordConstants');

// One emailed forgot-password code. See forgotPasswordService.js.
const passwordResetOtpSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Never the code itself - only its hash (same reasoning as RefreshToken.tokenHash).
    otpHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    // Every reset attempt against this code, right or wrong. The code stops
    // working once this reaches OTP_MAX_ATTEMPTS.
    attempts: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    // Set once the code has reset the password - a code works only once.
    usedAt: {
        type: Date,
        default: null
    },
    // 'A' = the account's current code. 'D' = replaced by a newer code.
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
}, {
    timestamps: true
});

passwordResetOtpSchema.index({ vendorId: 1, userId: 1, status: 1, createdAt: -1 });

// Mongo removes a record this long after its code expired.
passwordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: OTP_RECORD_RETENTION_SECONDS });

module.exports = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);
