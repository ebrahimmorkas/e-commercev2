const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },

    // Which calling module triggered this email, e.g. 'order', 'authVerification',
    // 'discount'. Kept as a free string (not enum) since more modules will use
    // this utility over time.
    module: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    provider: {
        type: String,
        enum: ['nodemailer', 'sendgrid', 'ses'],
        required: true
    },

    from: {
        type: String,
        required: true
    },
    to: {
        type: [String],
        required: true
    },
    cc: {
        type: [String],
        default: []
    },
    bcc: {
        type: [String],
        default: []
    },
    subject: {
        type: String,
        required: true
    },
    // Stored (not just passed through) so a FAILED send can actually be
    // replayed later by retryFailedEmails in emailService.js - without this,
    // there'd be nothing left to resend once the original caller's request
    // has finished. Attachments/images are NOT stored here (would mean
    // persisting raw file buffers in Mongo) - see attachmentCount/imageCount
    // below, which retryFailedEmails uses to skip anything it can't safely replay.
    html: {
        type: String,
        default: null
    },
    text: {
        type: String,
        default: null
    },
    // True when this send used the platform's DefaultEmailTemplateMaster
    // fallback rather than the vendor's own tagged template - see
    // resolveTemplateForModule in emailTemplateMasterService.js.
    isDefaultTemplate: {
        type: Boolean,
        default: false
    },

    // Written as 'FAILED' before the provider send is attempted, then flipped
    // to 'SENT' only after the provider confirms delivery - so a thrown
    // provider error (which propagates straight up per the house catch-block
    // rule of `throw err;` only, with no chance to update this record
    // afterwards) still leaves an accurate FAILED record rather than none at all.
    sendStatus: {
        type: String,
        enum: ['SENT', 'FAILED'],
        default: 'FAILED',
        required: true
    },
    providerMessageId: {
        type: String,
        default: null
    },
    attachmentCount: {
        type: Number,
        default: 0
    },
    imageCount: {
        type: Number,
        default: 0
    },

    // Retry bookkeeping - see retryFailedEmails in emailService.js. A retry
    // always creates its own fresh EmailLog row (via a normal sendEmail()
    // call, subject to the current feature/quota/content rules, not the
    // rules at original send time) - retrySucceededLogId links this FAILED
    // row to that new row once/if one of the retries succeeds, so the two
    // don't read as two disconnected, unexplained log entries.
    retryCount: {
        type: Number,
        default: 0
    },
    lastRetryAt: {
        type: Date,
        default: null
    },
    retrySucceededLogId: {
        type: mongoose.Types.ObjectId,
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

// Powers both the lifetime quota check (vendorId + sendStatus) and the
// per-month quota check (vendorId + sendStatus + createdAt range) in
// emailService.js.
emailLogSchema.index({ vendorId: 1, sendStatus: 1, createdAt: 1 });

// Powers the cross-vendor retryFailedEmails sweep in emailService.js.
emailLogSchema.index({ sendStatus: 1, retryCount: 1, createdAt: 1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
