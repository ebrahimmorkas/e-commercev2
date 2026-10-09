require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const CompanyMaster = require('../models/CompanyMaster');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const WeightMaster = require('../models/WeightMaster');
const SizeMaster = require('../models/SizeMaster');
const ModuleMaster = require('../models/ModuleMaster');
const OrderStepMaster = require('../models/OrderStepMaster');

// Sets up ONE demo store with everything switched on: the Vendor, its
// CompanyMaster (every feature on, every module assigned) and its admin login.
// seedCompanyMaster.js is the real HTM specification - this one is for a demo
// where the client should be able to try every feature.
//
// Run after seedWebsiteMaster, seedCountryMaster, seedStateMaster,
// seedCityMaster, seedWeightMaster, seedSizeMaster, seedModuleMaster and
// seedOrderStepMaster.
//
//   SEED_VENDOR_DOMAIN     storefront hostname, e.g. my-store.vercel.app (required)
//   SEED_VENDOR_EMAIL      vendor's email (required)
//   SEED_ADMIN_EMAIL       admin login email (default: SEED_VENDOR_EMAIL)
//   SEED_ADMIN_PASSWORD    admin login password (required when the admin is created)
//   SEED_ADMIN_PHONE       admin phone number (default below)
//   SEED_COUNTRY           ISO alpha-2 country the store sells in (default AE)
//   SEED_ADMIN_STATE       admin's state, by name (default Dubai)
//   SEED_ADMIN_CITY        admin's city, by name (default: same as the state)
//   SEED_SIZE_NAMES        SizeMaster names the store may use (default Size)
//   SEED_FEATURES_OFF      feature flags to keep off; "none" = everything on
//
// Safe to re-run: the vendor is matched by its email, so re-running with a new
// SEED_VENDOR_DOMAIN only moves the store to that domain (its _id, which every
// vendor-scoped document points at, never changes). An existing admin is left
// alone unless SEED_ADMIN_RESET_PASSWORD=1.

const VENDOR_DOMAIN = (process.env.SEED_VENDOR_DOMAIN || '').trim().toLowerCase();
const VENDOR_EMAIL = (process.env.SEED_VENDOR_EMAIL || '').trim().toLowerCase();
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || VENDOR_EMAIL).trim().toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '';
const ADMIN_PHONE = (process.env.SEED_ADMIN_PHONE || '0500000000').trim();
const COUNTRY_SHORT_NAME = (process.env.SEED_COUNTRY || 'AE').trim().toUpperCase();
const ADMIN_STATE_NAME = (process.env.SEED_ADMIN_STATE || 'Dubai').trim();

const ADMIN_CITY_NAME = (process.env.SEED_ADMIN_CITY || ADMIN_STATE_NAME).trim();

// SizeMaster names this store may use on product variants.
const ALLOWED_SIZE_NAMES = (process.env.SEED_SIZE_NAMES || 'Size').split(',').map((name) => name.trim()).filter(Boolean);

// Default: the features not built yet (off in WebsiteMaster too) stay off, and
// so does the payment gateway, as no gateway is set up for the store.
// SEED_FEATURES_OFF replaces this list (comma separated flag names);
// SEED_FEATURES_OFF=none switches every feature on.
const DEFAULT_FEATURES_KEPT_OFF = [
    'isEmailVerificationFeatureOn',
    'isSendingSMSFeatureOn',
    'isMobileVerificationFeatureOn',
    'isWebsiteBuilderFeatureOn',
    'isPaymentGatewayFeatureOn'
];
const FEATURES_KEPT_OFF = process.env.SEED_FEATURES_OFF
    ? process.env.SEED_FEATURES_OFF.split(',').map((flag) => flag.trim()).filter((flag) => flag && flag.toLowerCase() !== 'none')
    : DEFAULT_FEATURES_KEPT_OFF;

const IMAGE_FORMATS = ['jpg', 'png', 'jpeg'];

// Limits and choices - generous, so the demo is never stopped by a quota.
const COMPANY_MASTER_VALUES = {
    status: 'A',

    // Customers
    numberOfUsersAllowed: 10000,

    // Email
    emailService: 'nodemailer',
    numberOfEmailsAllowed: 10000,
    numberOfEmailsAllowedPerMonth: 5000,
    numberOfAttachmentsAllowedInSendEmail: 5,
    attachmentSizeAllowedInSendEmail: 10,
    numberOfImagesAllowedInSendEmail: 5,
    imageSizeAllowedInSendEmail: 2,
    numberOfTemplatesAllowed: 50,

    // Storage - Cloudinary for everything (the live server keeps no files on disk)
    imageService: 'cloudinary',
    videoService: 'cloudinary',
    fileService: 'cloudinary',
    maxVideoSize: 50,
    allowedVideoFormat: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'],

    // Announcements / Banners
    numberOfAnnouncementsAllowed: 10,
    numberOfBannersAllowed: 10,
    allowedBannerImagesMB: 5,
    allowedBannerImagesFormat: IMAGE_FORMATS,
    allowedBannerVideoMB: 50,
    mediaUploadAllowedInBanner: 'both',

    // Categories
    numberOfMainCategoriesAllowed: 100,
    numberOfSubcategoriesAllowed: 100,
    allowedCategoryImageMB: 5,
    allowedCategoryImagesFormat: IMAGE_FORMATS,

    // Products
    numberOfProductsAllowed: 5000,
    numberOfProductsVaiantsAllowed: 50,
    numberOfAdditionalImagesAllowedInVariant: 5,
    productsPerPage: 24,
    allowedProductImageMB: 5,
    allowedProductImagesFormat: IMAGE_FORMATS,
    numberOfBrandsAllowed: 100,
    numberOfReviewsAllowedOnProduct: 1000,

    // Discounts
    numberOfDiscountsPerMonth: 100,
    allowedConstantsOfGiveDiscountTo: [
        'ALL_PRODUCTS_ALL_USERS',
        'SPECIFIC_PRODUCTS_ALL_USERS',
        'SPECIFIC_CATEGORIES_ALL_USERS',
        'PRODUCT_GROUP_ALL_USERS',
        'CATEGORY_GROUP_ALL_USERS',
        'USER_GROUP',
        'ALL_PRODUCTS_SPECIFIC_USERS',
        'SPECIFIC_PRODUCTS_SPECIFIC_USERS',
        'SPECIFIC_CATEGORIES_SPECIFIC_USERS',
        'CATEGORY_GROUP_SPECIFIC_USERS',
        'PRODUCT_GROUP_SPECIFIC_USERS',
        'PRODUCT_VARIANTS_SPECIFIC_USERS',
        'PRODUCT_VARIANTS_ALL_USERS'
    ],
    allowedDiscountFeatureTypes: [
        'ONGOING_DISCOUNT',
        'MINIMUM_QUANTITY_DISCOUNT',
        'COUPON_CODE_DISCOUNT',
        'SCHEDULED_DISCOUNT',
        'SPECIFIC_DAYS_DISCOUNT',
        'SPECIFIC_DAYS_HOURS_DISCOUNT',
        'PAYMENT_METHOD_DISCOUNT'
    ],
    allowedDiscountTypes: ['FIXED_PRICE', 'PERCENTAGE'],

    // Groups
    numberOfGroupsAllowed: 50,
    numberOfMembersPerGroup: 500,
    allowedGroupTypes: ['PRODUCT', 'CATEGORY', 'USER', 'BRAND', 'ORDER', 'CUSTOM'],

    // Cart / Orders / Favorites
    numberOfProductsAllowedInCartAtOnce: 1000,
    numberOfOrdersAllowed: 10000,
    numberOfOrdersAllowedPerMonth: 1000000,
    numberOfDeliveryAgentsAllowed: 20,
    numberOfCouriersAllowed: 20,
    numberOfItemsAllowedInFavorites: 500,

    // Shipping
    allowedShippingPriceMethods: ['FREE', 'FIXED', 'CATEGORY', 'COUNTRY', 'STATE', 'CITY', 'ZIP', 'WEIGHT', 'CUSTOM'],

    // Payment - no gateway
    paymentGateway: null,

    // Commission
    commissionPercentage: 0,

    // Free Cash
    numberOfFreeCashToGiveAllowed: 1000,
    numberOfFreeCashToGiveAllowedPerMonth: 100,
    freeCashOptions: ['ALL_USERS', 'SPECIFIC_USERS', 'ONLY_MAIN_CATEGORY', 'MAIN_CATEGORY_AND_SUB_CATEGORY', 'GROUPS']
};

// Every on/off switch CompanyMaster has, read from the schema itself so a
// feature flag added later is switched on here without editing this file.
const buildFeatureFlags = () => {
    try {
        const flags = {};
        for (const [path, schemaType] of Object.entries(CompanyMaster.schema.paths)) {
            if (schemaType.instance === 'Boolean') {
                flags[path] = !FEATURES_KEPT_OFF.includes(path);
            }
        }
        return flags;
    } catch (error) {
        throw error;
    }
};

const seedVendor = async () => {
    try {
        const vendor = await Vendor.findOneAndUpdate(
            { email: VENDOR_EMAIL },
            {
                $set: { domain: VENDOR_DOMAIN, email: VENDOR_EMAIL, isActive: true, isDeleted: false, updatedAt: new Date() }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
        );
        return vendor;
    } catch (error) {
        throw error;
    }
};

const seedCompanyMaster = async (vendor, country) => {
    try {
        const weights = await WeightMaster.find({ status: 'A' }).select('_id');
        if (weights.length === 0) throw new Error('No active weight units found. Please run seedWeightMaster first.');

        const sizes = await SizeMaster.find({ name: { $in: ALLOWED_SIZE_NAMES }, status: 'A' }).select('_id');
        if (sizes.length !== ALLOWED_SIZE_NAMES.length) {
            throw new Error(`Sizes ${ALLOWED_SIZE_NAMES.join(', ')} not found. Please run seedSizeMaster first.`);
        }

        const modules = await ModuleMaster.find({ status: 'A' });
        if (modules.length === 0) throw new Error('No active modules found. Please run seedModuleMaster first.');

        const orderSteps = await OrderStepMaster.findOne({ status: 'A' }).sort({ createdAt: 1 });
        if (!orderSteps) throw new Error('No order workflow found. Please run seedOrderStepMaster first.');

        const company = await CompanyMaster.findOneAndUpdate(
            { vendorId: vendor._id },
            {
                $set: {
                    ...buildFeatureFlags(),
                    ...COMPANY_MASTER_VALUES,
                    vendorId: vendor._id,
                    allowedCountries: [country._id],
                    allowedSizes: sizes.map((size) => size._id)
                },
                // An order workflow already given to this vendor is never swapped
                // by a re-run - its orders keep following the one they were placed on.
                $setOnInsert: { orderSteps: orderSteps._id },
                $addToSet: {
                    allowedWeights: { $each: weights.map((weight) => weight._id) }
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
        );

        // Every active module, with no expiry. A revoked or expired one is re-activated.
        const now = new Date();
        let changed = 0;
        for (const module of modules) {
            const existing = company.assignedModules.find((entry) => entry.moduleId.toString() === module._id.toString());
            if (!existing) {
                company.assignedModules.push({ moduleId: module._id, startDate: now, expiryDate: null, assignedAt: now, revokedAt: null });
                changed++;
            } else if (existing.revokedAt || existing.expiryDate) {
                existing.revokedAt = null;
                existing.expiryDate = null;
                changed++;
            }
        }
        if (changed > 0) await company.save();

        const flags = buildFeatureFlags();
        const onCount = Object.values(flags).filter(Boolean).length;
        return company;
    } catch (error) {
        throw error;
    }
};

const seedAdmin = async (vendor, country) => {
    try {
        const existing = await User.findOne({ vendorId: vendor._id, email: ADMIN_EMAIL });

        // User.country/state/city hold CountryMaster/StateMaster/CityMaster ids
        // (see services/userLocationService.js).
        const state = await StateMaster.findOne({ country_id: country._id, state_name: ADMIN_STATE_NAME });
        if (!state) throw new Error(`State ${ADMIN_STATE_NAME} not found in ${country.country_name}. Please run seedStateMaster first.`);
        const city = await CityMaster.findOne({ state_id: state._id, city_name: ADMIN_CITY_NAME });
        const location = {
            country: country._id.toString(),
            state: state._id.toString(),
            ...(city ? { city: city._id.toString() } : {})
        };

        if (existing && process.env.SEED_ADMIN_RESET_PASSWORD != 1) {
            // Its location follows the store's country; its password is left alone.
            existing.set(location);
            await existing.save();
            return existing;
        }

        if (!ADMIN_PASSWORD) throw new Error('Set SEED_ADMIN_PASSWORD.');
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, Number(process.env.SALT_ROUNDS) || 10);

        if (existing) {
            existing.password = hashedPassword;
            existing.role = 'admin';
            existing.status = 'A';
            existing.set(location);
            await existing.save();
            return existing;
        }

        const admin = await User.create({
            vendorId: vendor._id,
            name: 'Admin',
            username: 'admin',
            password: hashedPassword,
            authProvider: 'local',
            phone_no: ADMIN_PHONE,
            email: ADMIN_EMAIL,
            ...location,
            role: 'admin',
            status: 'A'
        });
        return admin;
    } catch (error) {
        throw error;
    }
};

async function seedDemoStore() {
    try {
        if (!VENDOR_DOMAIN || !VENDOR_EMAIL) {
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const country = await CountryMaster.findOne({ short_country_name: COUNTRY_SHORT_NAME, status: 'A' });
        if (!country) throw new Error(`Country ${COUNTRY_SHORT_NAME} not found. Please run seedCountryMaster first.`);

        const vendor = await seedVendor();
        await seedCompanyMaster(vendor, country);
        await seedAdmin(vendor, country);


        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedDemoStore();
