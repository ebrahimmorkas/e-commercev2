require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const CompanyMaster = require('../models/CompanyMaster');
const CountryMaster = require('../models/CountryMaster');
const WeightMaster = require('../models/WeightMaster');
const SizeMaster = require('../models/SizeMaster');
const ModuleMaster = require('../models/ModuleMaster');

// CompanyMaster for HUTAIB TAILORING MATERIALS TRADING LLC (hutaib.com), per
// Section 2 "Platform Specifications" of the HTM project document (12 Sep 2026).
// Features the document doesn't list are out of its scope and switched off.
//
// Run after seedVendor, seedCountryMaster, seedWeightMaster, seedSizeMaster
// and seedModuleMaster.
//
// Safe to re-run: the vendor's CompanyMaster is updated in place; sizes,
// weight units and modules are only ever added (an existing assignedModules
// entry, including a revoked one, is left alone).

const VENDOR_DOMAIN = 'hutaib.com';

// Only the UAE is assigned to this vendor.
const ALLOWED_COUNTRY_SHORT_NAMES = ['AE'];

// SizeMaster names this vendor may use on product variants (Small / Medium / Large).
const ALLOWED_SIZE_NAMES = ['Size'];

const IMAGE_FORMATS = ['jpg', 'png', 'jpeg'];

// Modules this vendor gets (ModuleMaster.code). No expiry.
const ASSIGNED_MODULE_CODES = [
    'DASHBOARD',
    'PRODUCTS',
    'CATEGORIES',
    'ORDERS',
    'CUSTOMERS',
    'DISCOUNT',
    'BANNER',
    'ANNOUNCEMENT',
    'COMPANY_SETTINGS',
    'EMAIL_TEMPLATE'
];

const COMPANY_MASTER = {
    status: 'A',

    // Customers - Registered User Limit (per Master Policy)
    numberOfUsersAllowed: 2500,
    isPasswordChangeFeatureByAdminAllowed: false,
    isAdminAddingUserFeatureAllowed: false,
    isAdminPlacingOrderOnBehalfOfUserIsOn: false,
    isTaxRegistrationFeatureOn: true,

    // Email - Free Tier Node Mailer, 1,100 in total, 100 per month
    isSendingEmailFeatureOn: true,
    isEmailVerificationFeatureOn: false,
    emailService: 'nodemailer',
    numberOfEmailsAllowed: 1100,
    numberOfEmailsAllowedPerMonth: 100,
    isEmailTemplateFeatureOn: true,

    // SMS - not implemented
    isSendingSMSFeatureOn: false,
    isMobileVerificationFeatureOn: false,

    // Announcements - 5 slots
    isAnnouncementFeatureOn: true,
    numberOfAnnouncementsAllowed: 5,

    // Hero banners - 2, images only (PNG, JPG, JPEG)
    isBannerFeatureOn: true,
    numberOfBannersAllowed: 2,
    allowedBannerImagesFormat: IMAGE_FORMATS,
    mediaUploadAllowedInBanner: 'image',

    // Categories - 50 main, 50 sub-categories per category, image 2 MB
    isCategoryFeatureOn: true,
    numberOfMainCategoriesAllowed: 50,
    numberOfSubcategoriesAllowed: 50,
    isTaggingChildrenCategoryAllowed: true,
    allowedCategoryImageMB: 2,
    allowedCategoryImagesFormat: IMAGE_FORMATS,
    isBulkUploadForCategoriesFeatureOn: true,

    // Products - 5,000 products, 50 variants each, 3 additional images per
    // variant, image 3 MB
    numberOfProductsAllowed: 5000,
    numberOfProductsVaiantsAllowed: 50,
    numberOfAdditionalImagesAllowedInVariant: 3,
    allowedProductImageMB: 3,
    allowedProductImagesFormat: IMAGE_FORMATS,
    isCategoryNestingAllowed: true,
    isBulkUploadForProductsFeatureOn: true,
    isBulkUpdatingProductsAllowed: false,
    isCloningProductAllowed: false,
    isBulkPricingFeatureOn: false,
    isReturnFeatureOn: false,
    isExchangeFeatureOn: false,

    // Storage - Cloudinary; no video
    imageService: 'cloudinary',
    videoService: 'cloudinary',
    isVideoUploadingFeatureOn: false,

    // Discounts - 6 per month
    isDiscountFeatureOn: true,
    numberOfDiscountsPerMonth: 6,
    allowedConstantsOfGiveDiscountTo: [
        'ALL_PRODUCTS_ALL_USERS',
        'SPECIFIC_PRODUCTS_ALL_USERS',
        'SPECIFIC_CATEGORIES_ALL_USERS',
        'ALL_PRODUCTS_SPECIFIC_USERS',
        'SPECIFIC_PRODUCTS_SPECIFIC_USERS',
        'SPECIFIC_CATEGORIES_SPECIFIC_USERS'
    ],
    allowedDiscountFeatureTypes: ['ONGOING_DISCOUNT', 'COUPON_CODE_DISCOUNT'],
    allowedDiscountTypes: ['FIXED_PRICE', 'PERCENTAGE'],

    // Cart & Orders - no order limits
    isCartFeatureOn: true,
    numberOfOrdersAllowed: null,
    numberOfOrdersAllowedPerMonth: null,
    isOrderTrakingAllowed: true,
    isOrderStatusUpdationAllowedByDeliveryAgents: false,
    isEmailSendingFeatureOnAfterOrderStatusChanges: true,
    isPDFDownloadableFeatureOn: false,

    // Shipping - Free, Fixed, Weight ("Free Above" is ShippingPriceSettings.
    // freeAboveThreshold, set by the vendor on top of any method)
    isShippingPriceFeatureOn: true,
    allowedShippingPriceMethods: ['FREE', 'FIXED', 'WEIGHT'],
    isEditingShippingPriceFeatureOn: false,
    isEditingShippingAddressAfterOrderIsPlacedFeatureOn: false,
    isEditingOrderFeatureOn: false,

    // Payment - no gateway, no COD: the customer pays using the bank details /
    // QR code shown by the store and the admin approves the order
    isPaymentGatewayFeatureOn: false,
    isCODFeatureOn: false,
    paymentGateway: null,
    showPaymentQRCodeAndBankDetails: true,
    isShowingPartnerCertificateFeatureOn: false,

    // Out of scope
    isWebsiteBuilderFeatureOn: false,
    isBrandFeatureOn: false,
    isGroupFeatureOn: false,
    isExcelUploadAllowedForGroups: false,
    isReviewFeatureOn: false,
    isFavoritesFeatureOn: false,
    isAbondonedCartFeatureOn: false,
    isCommissionFeatureOn: false,
    commissionPercentage: 0,
    isFreeCashFeatureOn: false,
    isFreeCashGivingToSpecificUsersAllowed: false,
    isFreeCashGivingToGroupsAllowed: false,
    isFreeCashGivingToSpecificCategoryAllowed: false,
    isFreeCashGivingToNestedSubCategoryAllowed: false,
    isRevokingFreeCashFunctionalityAllowed: false,
    isRevokingAllUsersFreeCashFunctionalityAllowed: false,
    isFreeCashGivingToAllUsersFunctionalityAllowed: false,
    isFreeCashRefundFeatureOn: false,
    freeCashOptions: []
};

async function seedCompanyMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        const countries = await CountryMaster.find({ short_country_name: { $in: ALLOWED_COUNTRY_SHORT_NAMES }, status: 'A' });
        if (countries.length !== ALLOWED_COUNTRY_SHORT_NAMES.length) {
            throw new Error(`Countries ${ALLOWED_COUNTRY_SHORT_NAMES.join(', ')} not found. Please run seedCountryMaster first.`);
        }

        // Weight units, for product weights and the WEIGHT shipping method.
        const weights = await WeightMaster.find({ status: 'A' }).select('_id');
        if (weights.length === 0) {
            throw new Error('No active weight units found. Please run seedWeightMaster first.');
        }

        const sizes = await SizeMaster.find({ name: { $in: ALLOWED_SIZE_NAMES }, status: 'A' }).select('_id');
        if (sizes.length !== ALLOWED_SIZE_NAMES.length) {
            throw new Error(`Sizes ${ALLOWED_SIZE_NAMES.join(', ')} not found. Please run seedSizeMaster first.`);
        }

        const modules = await ModuleMaster.find({ code: { $in: ASSIGNED_MODULE_CODES }, status: 'A' });
        const missingCodes = ASSIGNED_MODULE_CODES.filter((code) => !modules.some((module) => module.code === code));
        if (missingCodes.length > 0) {
            throw new Error(`Modules ${missingCodes.join(', ')} not found. Please run seedModuleMaster first.`);
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

        console.log(`✅ CompanyMaster seeded for ${VENDOR_DOMAIN} (${added} module(s) assigned).`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCompanyMaster();
