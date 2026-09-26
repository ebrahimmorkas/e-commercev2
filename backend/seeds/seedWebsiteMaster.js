require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const WebsiteMaster = require('../models/WebsiteMaster');

// WebsiteMaster is the platform-wide switchboard: a feature works for a vendor
// only when it is on here AND in that vendor's CompanyMaster (see
// checkFeatureOnOrOff in utils/common.js). Every built feature is switched on
// here so each vendor's CompanyMaster alone decides what that vendor gets.
//
// Switched off: SMS / mobile verification, email verification and the website
// builder - none of them is implemented yet.
//
// Safe to re-run: there is a single WebsiteMaster document, updated in place.
const WEBSITE_MASTER = {
    status: 'A',

    // Messages
    temporaryFeatureOffMessage: 'This feature is temporarily unavailable. Please check back later.',
    featureDisabledForVendorMessage: 'This feature is not enabled for your account. Please contact support.',
    featureDisabledMessageForClient: 'This feature is disabled for this store.',

    // Email / SMS
    isSendingEmailFeatureOn: true,
    isEmailVerificationFeatureOn: false,
    isSendingSMSFeatureOn: false,
    isMobileVerificationFeatureOn: false,
    mainEmailService: null,              // null = each vendor uses its own CompanyMaster.emailService

    // Email Template
    isEmailTemplateFeatureOn: true,
    isAddingOfAttachmentAllowed: true,
    isAddingOfImageAllowed: true,
    isCcAndBccFeatureOn: true,
    isControlSelectionFeatureOn: true,
    isEmbeddingLinksAllowed: true,

    // Content
    isAnnouncementFeatureOn: true,
    isBannerFeatureOn: true,
    isWebsiteBuilderFeatureOn: false,
    isPDFDownloadableFeatureOn: true,

    // Categories
    isCategoryFeatureOn: true,
    isTaggingChildrenCategoryAllowed: true,
    isBulkUploadForCategoriesFeatureOn: true,

    // Images / Videos
    mainImageService: 'cloudinary',
    enforceMainImageService: false,
    isVideoUploadingFeatureOn: true,
    mainVideoService: 'cloudinary',
    enforceMainVideoService: false,

    // Products
    isBrandFeatureOn: true,
    isProductReviewFeatureOn: true,
    isBulkPricingFeatureOn: true,
    isCloningProductAllowed: true,
    isBulkUploadForProductsFeatureOn: true,
    isBulkUpdatingProductsAllowed: true,
    isReturnFeatureOn: true,
    isExchangeFeatureOn: true,

    // Discount / Groups / Favorites / Cart
    isDiscountFeatureOn: true,
    isGroupFeatureOn: true,
    isFavoritesFeatureOn: true,
    isCartFeatureOn: true,
    isAbondonedCartFeatureOn: true,

    // Orders
    isOrderTrakingAllowed: true,
    isEmailSendingFeatureOnAfterOrderStatusChanges: true,

    // Shipping Price
    isShippingPriceFeatureOn: true,
    isEditingShippingPriceFeatureOn: true,
    isEditingShippingAddressAfterOrderIsPlacedFeatureOn: true,
    isEditingOrderFeatureOn: true,

    // Payment
    isPaymentGatewayFeatureOn: true,
    isCODFeatureOn: true,
    mainPaymentGateway: null,            // null = each vendor uses its own CompanyMaster.paymentGateway
    isShowingPaymentQRCodeAndBankDetailsFeatureOn: true,
    isShowingPartnerCertificateFeatureOn: true,

    // Free Cash
    isFreeCashFeatureOn: true,
    isFreeCashGivingToSpecificUsersAllowed: true,
    isFreeCashGivingToGroupsAllowed: true,
    isFreeCashGivingToSpecificCategoryAllowed: true,
    isFreeCashGivingToNestedSubCategoryAllowed: true,
    isRevokingFreeCashFunctionalityAllowed: true,
    isRevokingAllUsersFreeCashFunctionalityAllowed: true,
    isFreeCashGivingToAllUsersFunctionalityAllowed: true,
    isFreeCashRefundFeatureOn: true,

    // Customer Management
    isPasswordChangeFeatureByAdminAllowed: true,
    isAdminAddingUserFeatureAllowed: true,
    isAdminPlacingOrderOnBehalfOfUserIsOn: true,
    isTaxRegistrationFeatureOn: true
};

async function seedWebsiteMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        const website = await WebsiteMaster.findOneAndUpdate(
            {},
            { $set: WEBSITE_MASTER },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        console.log(`✅ WebsiteMaster seeded successfully (${website._id}).`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedWebsiteMaster();
