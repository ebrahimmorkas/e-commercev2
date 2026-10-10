require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const CompanyMaster = require('../models/CompanyMaster');
const CountryMaster = require('../models/CountryMaster');
const WeightMaster = require('../models/WeightMaster');
const SizeMaster = require('../models/SizeMaster');
const ModuleMaster = require('../models/ModuleMaster');

// CompanyMaster for mouldmarket.in: every built feature switched on and every
// count limit set as high as it goes, so this vendor is effectively unlimited.
//
// Run after seedVendor, seedCountryMaster, seedWeightMaster, seedSizeMaster
// and seedModuleMaster. A feature also needs its switch on in WebsiteMaster
// (seedWebsiteMaster) - see checkFeatureOnOrOff in utils/common.js.
//
// Safe to re-run: the vendor's CompanyMaster is updated in place; sizes,
// weight units and modules are only ever added (an existing assignedModules
// entry, including a revoked one, is left alone).

const VENDOR_DOMAIN = 'mouldmarket.in';

// Only India is assigned to this vendor.
const ALLOWED_COUNTRY_SHORT_NAMES = ['IN'];

// "Unlimited" for every count limit (how many products, orders, emails, ...).
const UNLIMITED = 999999999999;

// File size limits (MB) are NOT set to UNLIMITED: an upload can never be
// bigger than the app's own hard ceilings, so these are set to those ceilings.
//   - images: 20 MB (middlewares/imageUpload.js)
//   - email attachments and videos: 100 MB (middlewares/emailContentUpload.js)
// The storage provider's own plan limit (Cloudinary) still applies on top.
const MAX_IMAGE_MB = 20;
const MAX_FILE_MB = 100;

const IMAGE_FORMATS = ['jpg', 'png', 'jpeg'];

const COMPANY_MASTER = {
    status: 'A',

    // Customers
    numberOfUsersAllowed: UNLIMITED,
    isPasswordChangeFeatureByAdminAllowed: true,
    isAdminAddingUserFeatureAllowed: true,
    isAdminPlacingOrderOnBehalfOfUserIsOn: true,
    isTaxRegistrationFeatureOn: true,
    isForgotPasswordFunctionalityOn: true,

    // Email
    isSendingEmailFeatureOn: true,
    isSendEmailModuleOn: true,
    isSendingEmailToUsersOutOfStoreAllowed: true,
    numberOfAttachmentsAllowedInSendEmail: UNLIMITED,
    attachmentSizeAllowedInSendEmail: MAX_FILE_MB,
    numberOfImagesAllowedInSendEmail: UNLIMITED,
    imageSizeAllowedInSendEmail: MAX_IMAGE_MB,
    emailService: 'nodemailer',
    numberOfEmailsAllowed: UNLIMITED,
    numberOfEmailsAllowedPerMonth: UNLIMITED,

    // Email Template
    isEmailTemplateFeatureOn: true,
    isDifferentEmailTemplatesForOrderStepsOn: true,
    isInvoiceSendingFeatureInEmailOn: true,
    numberOfTemplatesAllowed: UNLIMITED,
    numberOfAttachmentsAllowed: UNLIMITED,
    numberOfImageAllowed: UNLIMITED,
    attachmentSizeAllowed: MAX_FILE_MB,
    imageSizeAllowed: MAX_IMAGE_MB,
    isAddingOfAttachmentAllowed: true,
    isAddingOfImageAllowed: true,
    allowedAttachmentExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'],
    allowedImageExtensions: ['jpg', 'jpeg', 'png'],
    isCcAndBccFeatureOn: true,
    isControlSelectionFeatureOn: true,
    isEmbeddingLinksAllowed: true,

    // Not built yet - switched off (they are off in WebsiteMaster too).
    isEmailVerificationFeatureOn: false,
    isSendingSMSFeatureOn: false,
    isMobileVerificationFeatureOn: false,
    isWebsiteBuilderFeatureOn: false,

    // Announcements
    isAnnouncementFeatureOn: true,
    numberOfAnnouncementsAllowed: UNLIMITED,

    // Banners - image or video
    isBannerFeatureOn: true,
    numberOfBannersAllowed: UNLIMITED,
    allowedBannerImagesMB: MAX_IMAGE_MB,
    allowedBannerImagesFormat: IMAGE_FORMATS,
    allowedBannerVideoMB: MAX_FILE_MB,
    mediaUploadAllowedInBanner: 'both',

    // Categories
    isCategoryFeatureOn: true,
    numberOfMainCategoriesAllowed: UNLIMITED,
    numberOfSubcategoriesAllowed: UNLIMITED,
    isTaggingChildrenCategoryAllowed: true,
    isCategoryNestingAllowed: true,
    allowedCategoryImageMB: MAX_IMAGE_MB,
    allowedCategoryImagesFormat: IMAGE_FORMATS,
    isBulkUploadForCategoriesFeatureOn: true,

    // Products
    numberOfProductsAllowed: UNLIMITED,
    numberOfProductsVaiantsAllowed: UNLIMITED,
    numberOfAdditionalImagesAllowedInVariant: UNLIMITED,
    // Not a limit: how many products the storefront loads per page / scroll
    // step (the model allows 1-100). 24 keeps pages fast.
    productsPerPage: 24,
    allowedProductImageMB: MAX_IMAGE_MB,
    allowedProductImagesFormat: IMAGE_FORMATS,
    isBulkUploadForFeatureOn: true,
    isBulkUploadForProductsFeatureOn: true,
    isBulkUpdatingProductsAllowed: true,
    isCloningProductAllowed: true,
    isBulkPricingFeatureOn: true,
    isReceivingLowStockAlertFeatureOn: true,
    isReturnFeatureOn: true,
    isExchangeFeatureOn: true,
    fileUploadSize: MAX_IMAGE_MB,
    isPDFDownloadableFeatureOn: true,
    isCatalogueDownloadFeatureOn: true,

    // Storage - Cloudinary for images, files and videos
    imageService: 'cloudinary',
    fileService: 'cloudinary',
    videoService: 'cloudinary',
    isVideoUploadingFeatureOn: true,
    maxVideoSize: MAX_FILE_MB,
    allowedVideoFormat: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'],

    // Brands
    isBrandFeatureOn: true,
    numberOfBrandsAllowed: UNLIMITED,

    // Couriers
    isCourierFeatureOn: true,
    numberOfCouriersAllowed: UNLIMITED,

    // Groups - every group type
    isGroupFeatureOn: true,
    numberOfGroupsAllowed: UNLIMITED,
    numberOfMembersPerGroup: UNLIMITED,
    allowedGroupTypes: ['PRODUCT', 'CATEGORY', 'USER', 'BRAND', 'ORDER', 'CUSTOM'],
    isExcelUploadAllowedForGroups: true,
    isNestingCategoryAllowedInGroup: true,

    // Reviews
    isReviewFeatureOn: true,
    numberOfReviewsAllowedOnProduct: UNLIMITED,

    // Favorites
    isFavoritesFeatureOn: true,
    numberOfItemsAllowedInFavorites: UNLIMITED,

    // Discounts - an empty list means "all of them allowed"
    isDiscountFeatureOn: true,
    numberOfDiscountsPerMonth: UNLIMITED,
    allowedConstantsOfGiveDiscountTo: [],
    allowedDiscountFeatureTypes: [],
    allowedDiscountTypes: [],

    // Cart & Orders
    isCartFeatureOn: true,
    numberOfProductsAllowedInCartAtOnce: UNLIMITED,
    numberOfOrdersAllowed: UNLIMITED,
    numberOfOrdersAllowedPerMonth: UNLIMITED,
    isOrderTrakingAllowed: true,
    isOrderStatusUpdationAllowedByDeliveryAgents: true,
    numberOfDeliveryAgentsAllowed: UNLIMITED,
    isAbondonedCartFeatureOn: true,
    isEmailSendingFeatureOnAfterOrderStatusChanges: true,
    isEmailSendingFeatureOnAfterDeliveryAgentAssigned: true,
    isEmailSendingFeatureOnAfterDeliveryAgentChanged: true,
    isEmailSendingFeatureOnAfterDeliveryAgentUnassigned: true,
    isEmailSendingFeatureOnAfterDeliveryDateChanged: true,
    isEmailSendingFeatureOnAfterCourierAssigned: true,
    isEmailSendingFeatureOnAfterCourierChanged: true,
    isEmailSendingFeatureOnAfterCourierRemoved: true,
    isEmailSendingFeatureOnAfterDiscountAvailable: true,
    isEmailSendingFeatureOnBeforeDiscountExpires: true,
    isEmailSendingFeatureOnAfterFreeCashCredited: true,
    isEmailSendingFeatureOnAfterFreeCashUsed: true,
    isEmailSendingFeatureOnAfterFreeCashRefunded: true,
    isEmailSendingFeatureOnAfterFreeCashRevoked: true,
    isEmailSendingFeatureOnAfterFreeCashExpired: true,
    isEmailSendingFeatureOnBeforeFreeCashExpires: true,

    // Shipping - an empty list means every shipping price method is allowed
    isShippingPriceFeatureOn: true,
    allowedShippingPriceMethods: [],
    isEditingShippingPriceFeatureOn: true,
    isEditingShippingAddressAfterOrderIsPlacedFeatureOn: true,
    isEditingOrderFeatureOn: true,

    // Payment. Online payment is switched on, but it only works once a gateway
    // is chosen here (paymentGateway: 'paytabs' or 'stripe') AND the vendor's
    // gateway credentials are entered with
    // scripts/manageVendorPaymentGatewayCredentials.js. Until then a customer
    // who picks online payment is told no gateway is configured - the vendor
    // can hide it with "Online payment" in Company Settings > Payment & Bank.
    isPaymentGatewayFeatureOn: true,
    paymentGateway: null,
    isCODFeatureOn: true,
    showPaymentQRCodeAndBankDetails: true,
    showGpayNumber: true,
    isShowingPartnerCertificateFeatureOn: true,

    // Commission is the platform's cut of the vendor's sales, not a vendor
    // feature - off.
    isCommissionFeatureOn: false,
    commissionPercentage: 0,

    // Free Cash - an empty options list means every option is allowed
    isFreeCashFeatureOn: true,
    numberOfFreeCashToGiveAllowed: UNLIMITED,
    numberOfFreeCashToGiveAllowedPerMonth: UNLIMITED,
    isFreeCashGivingToSpecificUsersAllowed: true,
    isFreeCashGivingToGroupsAllowed: true,
    isFreeCashGivingToSpecificCategoryAllowed: true,
    isFreeCashGivingToNestedSubCategoryAllowed: true,
    isRevokingFreeCashFunctionalityAllowed: true,
    isRevokingAllUsersFreeCashFunctionalityAllowed: true,
    isFreeCashGivingToAllUsersFunctionalityAllowed: true,
    isFreeCashRefundFeatureOn: true,
    freeCashOptions: []
};

async function seedCompanyMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        const countries = await CountryMaster.find({ short_country_name: { $in: ALLOWED_COUNTRY_SHORT_NAMES }, status: 'A' });
        if (countries.length !== ALLOWED_COUNTRY_SHORT_NAMES.length) {
            throw new Error(`Countries ${ALLOWED_COUNTRY_SHORT_NAMES.join(', ')} not found. Please run seedCountryMaster first.`);
        }

        // Every active weight unit, for product weights and the WEIGHT shipping method.
        const weights = await WeightMaster.find({ status: 'A' }).select('_id');
        if (weights.length === 0) {
            throw new Error('No active weight units found. Please run seedWeightMaster first.');
        }

        // Every active size.
        const sizes = await SizeMaster.find({ status: 'A' }).select('_id');
        if (sizes.length === 0) {
            throw new Error('No active sizes found. Please run seedSizeMaster first.');
        }

        // Every active module. No expiry.
        const modules = await ModuleMaster.find({ status: 'A' });
        if (modules.length === 0) {
            throw new Error('No active modules found. Please run seedModuleMaster first.');
        }

        const company = await CompanyMaster.findOneAndUpdate(
            { vendorId: vendor._id },
            {
                $set: {
                    ...COMPANY_MASTER,
                    vendorId: vendor._id,
                    allowedCountries: countries.map((country) => country._id)
                },
                $addToSet: {
                    allowedWeights: { $each: weights.map((weight) => weight._id) },
                    allowedSizes: { $each: sizes.map((size) => size._id) }
                }
            },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        const now = new Date();
        const assignedIds = new Set(company.assignedModules.map((entry) => entry.moduleId.toString()));
        let added = 0;

        for (const module of modules) {
            if (assignedIds.has(module._id.toString())) continue;

            company.assignedModules.push({
                moduleId: module._id,
                startDate: now,
                expiryDate: null,
                assignedAt: now,
                revokedAt: null
            });
            added++;
        }

        if (added > 0) await company.save();

        process.stdout.write(`CompanyMaster ready for ${VENDOR_DOMAIN}: ${company.assignedModules.length} modules assigned (${added} new).\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedCompanyMaster failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCompanyMaster();
