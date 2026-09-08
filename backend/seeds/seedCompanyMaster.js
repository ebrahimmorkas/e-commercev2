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

                isBrandFeatureOn: true,
                numberOfBrandsAllowed: 100,

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
                isBulkUploadForCategoriesFeatureOn: true,

                emailService: "nodemailer",
                numberOfEmailsAllowed: 100000,
                numberOfEmailsAllowedPerMonth: null,

                isEmailTemplateFeatureOn: true,
                numberOfTemplatesAllowed: 20,
                numberOfAttachmentsAllowed: 3,
                numberOfImageAllowed: 3,
                attachmentSizeAllowed: 5,
                imageSizeAllowed: 2,
                isAddingOfAttachmentAllowed: true,
                isAddingOfImageAllowed: true,
                allowedAttachmentExtensions: ["pdf", "doc", "docx", "xlsx", "png", "jpg", "jpeg"],
                allowedImageExtensions: ["jpg", "jpeg", "png"],
                isCcAndBccFeatureOn: true,
                isControlSelectionFeatureOn: true,
                isEmbeddingLinksAllowed: true
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