const mongoose = require('mongoose');

// One email composed in the "Send Email" module, with its delivery to each
// recipient - the module's history. Every recipient gets their own separate
// email (see services/sentEmailService.js); each of those is also an EmailLog
// row (emailLogId).
const recipientSchema = new mongoose.Schema({
    // null for an address typed in that isn't a store customer.
    userId: { type: mongoose.Types.ObjectId, default: null },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, default: '' },
    // PENDING until tried; SENDING while its email is being handed to the
    // provider; SKIPPED = never tried because sending stopped (e.g. quota).
    // A recipient still SENDING after a server restart may or may not have
    // got the email, so it's marked FAILED rather than sent twice.
    status: { type: String, enum: ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'], default: 'PENDING' },
    error: { type: String, default: null },
    emailLogId: { type: mongoose.Types.ObjectId, default: null },
    sentAt: { type: Date, default: null }
}, { _id: false });

// A file that went with the email - from the Company Settings library
// (LIBRARY, not affected by clean-up) or uploaded just for this email
// (UPLOAD, deleted after WebsiteMaster.sendEmailFileRetentionDays).
const fileSchema = new mongoose.Schema({
    source: { type: String, enum: ['LIBRARY', 'UPLOAD'], required: true },
    fileAssetId: { type: mongoose.Types.ObjectId, default: null },
    imageAssetId: { type: mongoose.Types.ObjectId, default: null },
    // Attachment: the file name customers saw. Image: its {{image:name}}.
    name: { type: String, trim: true },
    url: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    // false once an uploaded file has been deleted by the clean-up.
    available: { type: Boolean, default: true }
}, { _id: false });

const sentEmailSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    htmlBody: {
        type: String,
        required: true
    },
    textBody: {
        type: String,
        default: null
    },
    // How the recipients were chosen (what the vendor picked on the form).
    recipientSelection: {
        allCustomers: { type: Boolean, default: false },
        customerCount: { type: Number, default: 0 },
        groupNames: { type: [String], default: [] },
        externalEmailCount: { type: Number, default: 0 }
    },
    recipients: {
        type: [recipientSchema],
        default: []
    },
    includeCompanyCcList: { type: Boolean, default: true },
    includeCompanyBccList: { type: Boolean, default: true },
    ccList: { type: [String], default: [] },
    bccList: { type: [String], default: [] },
    attachments: { type: [fileSchema], default: [] },
    images: { type: [fileSchema], default: [] },
    // SENDING while the background send runs; STOPPED = it had to stop
    // early (stoppedReason), e.g. the email quota ran out.
    sendStatus: {
        type: String,
        enum: ['SENDING', 'COMPLETED', 'STOPPED'],
        default: 'SENDING',
        index: true
    },
    stoppedReason: { type: String, default: null },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    // How many times delivery was picked up again after a server restart.
    resumeCount: { type: Number, default: 0 },
    // Who sent it (a copy of the name, so the history reads right later).
    sentByName: { type: String, trim: true, default: '' },
    // When the uploaded files were deleted by the clean-up (null = still kept).
    filesDeletedAt: { type: Date, default: null },

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

sentEmailSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('SentEmail', sentEmailSchema);
