require('dotenv').config();
const mongoose = require('mongoose');

const WebsiteMaster = require('../models/WebsiteMaster');

async function seedWebsiteMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const website = await WebsiteMaster.findOneAndUpdate(
            {},
            {
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

                isTaggingChildrenCategoryAllowed: true,

                isCategoryFeatureOn: true,

                temporaryFeatureOffMessage:
                    "This feature is temporarily unavailable. Please check back later.",

                featureDisabledForVendorMessage:
                    "This feature is not enabled for your account. Please contact support.",

                isBulkUploadForCategoriesFeatureOn: true
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log("WebsiteMaster seeded successfully.");
        console.log(website);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedWebsiteMaster();