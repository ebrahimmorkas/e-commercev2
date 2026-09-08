const mongoose = require('mongoose');

// Platform-owned fallback templates - used when a vendor has email sending
// on but either doesn't have the EmailTemplateMaster feature, or hasn't
// tagged a template for this module yet (see resolveTemplateForModule in
// emailTemplateMasterService.js). Authored by the platform admin only, never
// by a vendor, and never exposed to any vendor - same posture as
// OrderStepMaster (also platform-authored, also intentionally has no
// vendorId and no controller/routes - managed directly via seeds/DB).
const defaultEmailTemplateMasterSchema = mongoose.Schema({
    // One default per module - see constants/emailModuleConstants.js for
    // the valid set.
    module: {
        type: String,
        required: true,
        trim: true,
        unique: true,
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

module.exports = mongoose.model('DefaultEmailTemplateMaster', defaultEmailTemplateMasterSchema);
