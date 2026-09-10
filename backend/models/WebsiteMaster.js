const mongoose = require('mongoose');
const { VALID_PAYMENT_GATEWAYS } = require('../constants/paymentGatewayConstants');

const websiteMasterSchema = mongoose.Schema({
    numberOfUsersAllowed: {
        type: Number,
        default: 5,
    },
    isSendingEmailFeatureOn: {
        type: Boolean,
        default: false
    },
    isEmailVerificationFeatureOn: {
        type: Boolean,
        default: false
    },
    isSendingSMSFeatureOn: {
        type: Boolean,
        default: false
    },
    isMobileVerificationFeatureOn: {
        type: Boolean,
        default: false
    },
    fileUploadSize: {
        type: Number,
        default: 5
    },
    isPDFDownloadableFeatureOn: {
        type: Boolean,
        default: true
    },
    isAnnouncementFeatureOn: {
        type: Boolean,
        default: true
    },
    numberOfAnnouncementsAllowed: {
        type: Number,
        default: 2,
    },
    isBannerFeatureOn: {
        type: Boolean,
        default: true
    },
    numberOfBannersAllowed: {
        type: Number,
        default: 2
    },
    isWebsiteBuilderFeatureOn: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    isTaggingChildrenCategoryAllowed: {
        type: Boolean,
        default: true,
    },
    isCategoryFeatureOn: {
        type: Boolean,
        default: true
    },
    temporaryFeatureOffMessage: {
        type: String,
        default: 'This feature is temporarily unavailable. Please check back later.'
    },
    featureDisabledForVendorMessage: {
        type: String,
        default: 'This feature is not enabled for your account. Please contact support.'
    },
    featureDisabledMessageForClient: {
        type: String,
        default: 'This feature is disabled for this store.'
    },
    isBulkUploadForCategoriesFeatureOn: {
        type: Boolean,
    },
    mainImageService: {
        type: String,
        enum: ['cloudinary', 'aws', 'r2', 'local'],
        required: true
    },
    enforceMainImageService: {
        type: Boolean,
        default: false
    },
    isDiscountFeatureOn: {
        type: Boolean,
        default: true,
    },
    isGroupFeatureOn: {
        type: Boolean,
    },
    isProductReviewFeatureOn: {
        type: Boolean,
        default: true
    },
    isBulkPricingFeatureOn: {
        type: Boolean,
        default: true
    },
    isBrandFeatureOn: {
        type: Boolean,
        default: true
    },
    isReturnFeatureOn: {
        type: Boolean,
        default: true
    },
    isExchangeFeatureOn: {
        type: Boolean,
        default: true
    },
    bulkUploadExcelMaxSizeMB: {
        type: Number,
        default: 5
    },
    bulkUploadZipMaxSizeMB: {
        type: Number,
        default: 50
    },
    // Cart
    isCartFeatureOn: {
        type: Boolean,
        default: true
    },
    // Order
    isOrderTrakingAllowed: {
        type: Boolean,
        default: false
    },
    isEmailSendingFeatureOnAfterOrderStatusChanges: {
        type: Boolean,
        default: false
    },

    // Email
    // Non-null forces EVERY vendor onto this provider regardless of what
    // CompanyMaster.emailService assigns them - used to fail over off a
    // provider that's down. null = each vendor keeps using their own
    // assigned CompanyMaster.emailService. See resolveEmailProvider in
    // emailService.js.
    mainEmailService: {
        type: String,
        enum: ['nodemailer', 'sendgrid', 'ses'],
        default: null
    },
    // End of Email

    // Email Template
    // Gates the EmailTemplateMaster CRUD (creating/editing/deleting templates)
    // specifically. The 5 fields below are NOT tied to templates - they gate
    // attachments/images/cc-bcc/formatting/links for EVERY email-sending
    // module (the generic emailService.sendEmail, template-rendered emails,
    // anything else), same two-layer (website AND company) enforcement as
    // isSendingEmailFeatureOn. See emailService.js.
    isEmailTemplateFeatureOn: {
        type: Boolean,
        default: false
    },
    isAddingOfAttachmentAllowed: {
        type: Boolean,
        default: true
    },
    isAddingOfImageAllowed: {
        type: Boolean,
        default: true
    },
    isCcAndBccFeatureOn: {
        type: Boolean,
        default: true
    },
    // Whether rich-text formatting controls (bold/italic/underline/lists/
    // headings/etc.) are allowed in an email body - see
    // containsFormattingControls in emailService.js for what's scanned for.
    isControlSelectionFeatureOn: {
        type: Boolean,
        default: true
    },
    isEmbeddingLinksAllowed: {
        type: Boolean,
        default: true
    },
    // End of Email Template

    // Favorites
    isFavoritesFeatureOn: {
        type: Boolean,
        default: true
    },
    // End of Favorites

    // Shipping Price
    isShippingPriceFeatureOn: {
        type: Boolean,
        default: true
    },
    // End of Shipping Price

    // Payment
    isPaymentGatewayFeatureOn: {
        type: Boolean,
        default: false
    },
    isCODFeatureOn: {
        type: Boolean,
        default: false
    },
    // Non-null forces EVERY vendor onto this gateway regardless of what
    // CompanyMaster.paymentGateway assigns them - same override convention
    // as mainEmailService above. null = each vendor keeps using its own
    // admin-assigned CompanyMaster.paymentGateway. See resolvePaymentGateway
    // in paymentService.js.
    mainPaymentGateway: {
        type: String,
        enum: VALID_PAYMENT_GATEWAYS,
        default: null
    },
    // End of Payment

}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteMaster', websiteMasterSchema);