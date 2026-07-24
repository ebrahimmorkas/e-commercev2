require('dotenv').config();
const mongoose = require('mongoose');

const CompanyMaster = require('../models/CompanyMaster');

async function seedCompanyMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendorId = new mongoose.Types.ObjectId("6a63443e263b29b8e59374eb");

        const company = await CompanyMaster.findOneAndUpdate(
            { vendorId },
            {
                vendorId,

                isSendingEmailFeatureOn: true,
                isEmailVerificationFeatureOn: true,
                isSendingSMSFeatureOn: true,
                isMobileVerificationFeatureOn: true,

                fileUploadSize: 20,

                isPDFDownloadableFeatureOn: true,

                isAnnouncementFeatureOn: true,
                numberOfAnnouncementsAllowed: 100,

                isBannerFeatureOn: true,
                numberOfBannersAllowed: 100,

                isWebsiteBuilderFeatureOn: true,

                status: "A",

                allowedCountries: [],
                allowedSizes: [],

                numberOfMainCategoriesAllowed: null,
                numberOfSubcategoriesAllowed: null,

                isTaggingChildrenCategoryAllowed: true,

                allowedBannerMB: 10,
                allowedCategoryImageMB: 5,
                allowedCategoryImagesFormat: "jpg",

                isCategoryFeatureOn: true,
                isBulkUploadForCategoriesFeatureOn: true
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log("CompanyMaster seeded successfully.");
        console.log(company);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedCompanyMaster();