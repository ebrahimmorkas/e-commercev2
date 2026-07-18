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