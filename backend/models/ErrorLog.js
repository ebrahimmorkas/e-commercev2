const mongoose = require('mongoose');

// Written by utils/logger.js's logException() - never through a
// controller/service/route, since this record is deliberately not exposed
// through any API or role (see backend/middlewares/requestContext.js).
// Intended to be read directly from the database by the developer.
const errorLogSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },

    message: {
        type: String,
        required: true,
        trim: true
    },
    // ERROR = logException(): the request failed and the customer/admin was
    // shown the error page with this record's requestId as the reference.
    // WARNING = logWarning(): something went wrong but the request carried on
    // (e.g. an invoice email failed after the order was placed).
    severity: {
        type: String,
        enum: ['ERROR', 'WARNING'],
        default: 'ERROR',
        index: true
    },
    errorName: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    stack: {
        type: String,
        default: null
    },

    environment: {
        type: String,
        default: 'development'
    },
    server: {
        hostname: { type: String, default: null },
        pid: { type: Number, default: null }
    },

    // Correlates this record back to the exact HTTP request (also sent to
    // the client as the X-Request-Id response header by requestContext.js).
    requestId: {
        type: String,
        default: null,
        index: true
    },
    request: {
        method: { type: String, default: null },
        url: { type: String, default: null },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
        params: { type: mongoose.Schema.Types.Mixed, default: null },
        query: { type: mongoose.Schema.Types.Mixed, default: null },
        // Redacted - see the SENSITIVE_KEY_PATTERN redact() step in
        // utils/logger.js before this is ever written.
        body: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    user: {
        userId: { type: mongoose.Types.ObjectId, default: null },
        role: { type: String, default: null },
        country: { type: String, default: null },
        state: { type: String, default: null },
        city: { type: String, default: null }
    },

    // Whatever extra fields a call site passed beyond `error`, e.g.
    // logger.logException('Error creating product', { vendorId, id, error })
    // keeps `id` here. Also redacted.
    additionalData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Manually edited by the developer while triaging (no API updates this -
    // edit directly in the database).
    resolutionStatus: {
        type: String,
        enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
        default: 'NEW',
        required: true,
        index: true
    },
    resolutionNotes: {
        type: String,
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
}, {
    timestamps: true
});

errorLogSchema.index({ vendorId: 1, createdAt: -1 });
errorLogSchema.index({ vendorId: 1, resolutionStatus: 1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
