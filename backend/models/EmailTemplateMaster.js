const mongoose = require('mongoose');

const emailTemplateMasterSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    templateName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    // Free-text organizational label only (e.g. 'order', 'authVerification') -
    // NOT what binds this template to a feature. The actual binding is the
    // vendor's own choice, made via CompanySettings.emailTemplateAssignments
    // (one template per module, vendor-assignable there) - see
    // resolveTemplateForModule in emailTemplateMasterService.js.
    module: {
        type: String,
        trim: true,
        default: null,
        index: true
    },
    // May contain merge tokens (e.g. {{customerName}}) resolved by whichever
    // module renders and sends this template - this model only stores content.
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

// Two different vendors may both name a template "Order Confirmation" -
// uniqueness is scoped per vendor, not global.
emailTemplateMasterSchema.index({ vendorId: 1, templateName: 1 }, { unique: true });

module.exports = mongoose.model('EmailTemplateMaster', emailTemplateMasterSchema);
