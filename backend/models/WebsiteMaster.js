const mongoose = require('mongoose');

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
    isSendingEmailFeatureOn: {
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
}, {
  timestamps: true
});

module.exports = mongoose.model('WebsiteMaster', websiteMasterSchema);