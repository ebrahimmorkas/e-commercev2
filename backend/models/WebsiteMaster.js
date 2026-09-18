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
    // Global kill switch, on by default like isBannerFeatureOn/isCategoryFeatureOn -
    // CompanyMaster.isVideoUploadingFeatureOn (off by default, per-vendor entitlement)
    // is the actual gate for whether a given vendor can use video.
    isVideoUploadingFeatureOn: {
        type: Boolean,
        default: true
    },
    mainVideoService: {
        type: String,
        enum: ['cloudinary', 'aws', 'r2', 'local'],
        required: true
    },
    enforceMainVideoService: {
        type: Boolean,
        default: false
    },
    // Global hard cap (MB) for video uploads. null/0 = no site-wide override,
    // so CompanyMaster.maxVideoSize (the vendor's own limit) applies instead.
    // A real value here always wins over the vendor's setting - see
    // resolveMaxVideoSizeMB in videoUploadService.js.
    maxVideoSize: {
        type: Number,
        default: null
    },
    // Global override for allowed video extensions. Empty = no site-wide override,
    // so CompanyMaster.allowedVideoFormat (the vendor's own list) applies instead.
    // A non-empty list here always wins - see resolveAllowedVideoFormats in
    // videoUploadService.js. Falls back to ['mp4'] if neither model sets one.
    allowedVideoFormat: {
        type: [String],
        enum: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'],
        default: []
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
    // Global switch for product cloning - paired with
    // CompanyMaster.isCloningProductAllowed (per-vendor entitlement, off by
    // default) via checkFeatureOnOrOff. See cloneProduct/bulkCloneProducts
    // in productService.js.
    isCloningProductAllowed: {
        type: Boolean,
        default: true
    },
    isBrandFeatureOn: {
        type: Boolean,
        default: true
    },
    // Global switch, on by default - paired with
    // CompanyMaster.isBulkUpdatingProductsAllowed (per-vendor entitlement,
    // off by default) via checkFeatureOnOrOff. See bulkUpdateProducts in
    // productService.js.
    // NOTE: isBulkUploadForProductsFeatureOn (the create-flow's own gate)
    // has no matching field here - checkFeatureOnOrOff will read it as
    // undefined/false and reject every request at the website-level check.
    // Pre-existing gap, left untouched since it's outside this feature's scope.
    isBulkUpdatingProductsAllowed: {
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
    // Site-wide kill switch for CompanySettings.paymentScanner + the bank
    // transfer fields (bankAccountHolderName, bankName, bankAccountNumber,
    // ifscCode, branchName, swiftCode, bankAccountType) - paired with
    // CompanyMaster.showPaymentQRCodeAndBankDetails via checkFeatureOnOrOff,
    // see companySettingsService.js.
    isShowingPaymentQRCodeAndBankDetailsFeatureOn: {
        type: Boolean,
        default: false
    },
    // Site-wide kill switch for CompanySettings.partnerCertificate - paired
    // with CompanyMaster.isShowingPartnerCertificateFeatureOn via
    // checkFeatureOnOrOff, see companySettingsService.js.
    isShowingPartnerCertificateFeatureOn: {
        type: Boolean,
        default: false
    },
    // End of Payment

    // Abandoned Cart
    isAbondonedCartFeatureOn: {
        type: Boolean,
        default: true
    },
    // End of Abandoned Cart

    // Free Cash
    isFreeCashFeatureOn: {
        type: Boolean,
        default: true
    },
    isFreeCashGivingToSpecificUsersAllowed: {
        type: Boolean,
        default: true
    },
    isFreeCashGivingToGroupsAllowed: {
        type: Boolean,
        default: true
    },
    isFreeCashGivingToSpecificCategoryAllowed: {
        type: Boolean,
        default: true
    },
    isFreeCashGivingToNestedSubCategoryAllowed: {
        type: Boolean,
        default: true
    },
    isRevokingFreeCashFunctionalityAllowed: {
        type: Boolean,
        default: true
    },
    isRevokingAllUsersFreeCashFunctionalityAllowed: {
        type: Boolean,
        default: true
    },
    isFreeCashGivingToAllUsersFunctionalityAllowed: {
        type: Boolean,
        default: true
    },
    // Gates the Free-Cash-refund-on-order-return behavior specifically -
    // separate from the base isFreeCashFeatureOn, same two-layer
    // (websiteMaster AND companyMaster) convention as every other Free Cash
    // flag here. companySettings.returnFreeCashOnOrderReturn is the vendor's
    // own on/off choice underneath this admin-level gate.
    isFreeCashRefundFeatureOn: {
        type: Boolean,
        default: true
    },
    // End of Free Cash

    // Customer Management
    // Global switch, on by default like isCloningProductAllowed/
    // isBulkUpdatingProductsAllowed - CompanyMaster.isPasswordChangeFeatureByAdminAllowed
    // (off by default, per-vendor entitlement) is the actual gate for whether
    // a given vendor's admin can change a customer's password directly.
    isPasswordChangeFeatureByAdminAllowed: {
        type: Boolean,
        default: true
    },
    // Global switch, on by default like isPasswordChangeFeatureByAdminAllowed -
    // CompanyMaster.isAdminAddingUserFeatureAllowed (off by default,
    // per-vendor entitlement) is the actual gate for whether a given vendor's
    // admin can create customer accounts directly.
    isAdminAddingUserFeatureAllowed: {
        type: Boolean,
        default: true
    },
    // End of Customer Management

}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteMaster', websiteMasterSchema);