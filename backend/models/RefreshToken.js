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
    // grace window after rotation (see REFRESH_LOST_RESPONSE_GRACE_MS in
    // authService.js). Covers a browser that fires near-simultaneous refresh
    // calls with the same cookie, or never received a rotation's response
    // (aborted fetch / reload) and still holds the old token - so it gets a
    // valid renewed session instead of being logged out.
    previousTokenHash: {
        type: String,
        default: null
    },
    previousTokenExpiresAt: {
        type: Date,
        default: null
    },
    // When this session's token was last rotated. A request presenting the
    // previous token within a few seconds of this is racing that rotation's
    // own response and must not rotate again (see refreshAccessToken).
    rotatedAt: {
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