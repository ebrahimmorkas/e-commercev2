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

    // --- What goes out with this template (see emailTemplateMasterService
    // .buildTemplateEmailExtras). Each part only applies while its feature is
    // on for the account; saved choices are kept (just unused) when it's off.
    // Company Settings > Email CC/BCC lists - on by default, as every email
    // got them before templates could choose.
    includeCompanyCcList: {
        type: Boolean,
        default: true
    },
    includeCompanyBccList: {
        type: Boolean,
        default: true
    },
    // This template's own extra CC/BCC addresses (isCcAndBccFeatureOn).
    ccList: {
        type: [String],
        default: []
    },
    bccList: {
        type: [String],
        default: []
    },
    // Which Company Settings attachments (CompanySettings.emailAttachments
    // entry _ids) are attached - the library lives in Company Settings, a
    // template only picks from it. Together with attachInvoice, at most
    // CompanyMaster.numberOfAttachmentsAllowed.
    attachmentIds: {
        type: [mongoose.Types.ObjectId],
        default: []
    },
    // Which Company Settings images (CompanySettings.emailImages entry _ids)
    // this template may place in its body with {{image:name}}. At most
    // CompanyMaster.numberOfImageAllowed.
    imageIds: {
        type: [mongoose.Types.ObjectId],
        default: []
    },
    // Order templates only: attach the order's invoice PDF. Needs
    // isInvoiceSendingFeatureInEmailOn and step-wise Order templates
    // (isDifferentEmailTemplatesForOrderStepsOn); counts as one attachment.
    attachInvoice: {
        type: Boolean,
        default: false
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
}, {
    timestamps: true
});

// Two different vendors may both name a template "Order Confirmation" -
// uniqueness is scoped per vendor, not global. The index is partial (live
// templates only) so a soft-deleted template (status 'D') doesn't reserve its
// name forever - it mirrors the `status: { $ne: 'D' }` pre-checks in
// emailTemplateMasterService.js. (MongoDB partial indexes can't use $ne,
// hence $in.) Existing databases need scripts/migrateEmailTemplateIndexes.js
// run once - Mongoose won't change an existing index's options on its own.
emailTemplateMasterSchema.index(
    { vendorId: 1, templateName: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['A', 'I'] } } }
);

module.exports = mongoose.model('EmailTemplateMaster', emailTemplateMasterSchema);
