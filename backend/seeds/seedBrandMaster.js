require('dotenv').config();
const mongoose = require('mongoose');

const BrandMaster = require('../models/BrandMaster');

async function seedBrandMaster() {
    try {
        await mongoose.connect(`mongodb://127.0.0.1:27017/ecommerce-v2`);

        const vendorId = new mongoose.Types.ObjectId("6a63443e263b29b8e59374eb");

        const brands = [
            { brandName: "Nike", brandShortName: null, status: "A" },
            { brandName: "Adidas", brandShortName: null, status: "A" },
            { brandName: "Puma", brandShortName: null, status: "A" },
            { brandName: "United Colors of Benetton", brandShortName: "UCB", status: "A" },
            { brandName: "Levi Strauss & Co.", brandShortName: "Levi's", status: "I" }
        ];

        for (const brandData of brands) {
            const brand = await BrandMaster.findOneAndUpdate(
                { vendorId, brandName: brandData.brandName },
                {
                    vendorId,
                    brandName: brandData.brandName,
                    brandShortName: brandData.brandShortName,
                    status: brandData.status
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );
            console.log(`Seeded brand: ${brand.brandName}`);
        }

        console.log("BrandMaster seeded successfully.");

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedBrandMaster();
