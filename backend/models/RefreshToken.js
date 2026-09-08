const mongoose = require('mongoose');

const refreshTokenSchema = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        index: true
    },
    userAgent: {
        type: String,
        default: null
    },
    ip: {
        type: String,
        default: null
    },
    isValid: {
        type: Boolean,
        default: true
    },
    // The tokenHash this session just rotated away from, kept valid for a
    // short grace window after rotation (see REFRESH_REUSE_GRACE_MS in
    // authService.js). Covers the case where the same browser fires two
    // near-simultaneous refresh calls with the same (about-to-be-rotated)
    // cookie - e.g. two rapid page reloads - so the loser of that race gets
    // a valid renewed session instead of being logged out.
    previousTokenHash: {
        type: String,
        default: null
    },
    previousTokenExpiresAt: {
        type: Date,
        default: null
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    },
    // TTL index - MongoDB will auto-delete the document once expiresAt is reached,
    // so expired sessions clean themselves up without a cron job.
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);