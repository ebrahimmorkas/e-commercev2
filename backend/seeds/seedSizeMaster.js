// seeds/seedSizeMaster.js

require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const SizeMaster = require("../models/SizeMaster");

// Sizes a vendor can pick for a product variant. Which of these a vendor may
// use is CompanyMaster.allowedSizes (see seedCompanyMaster).
//
// Safe to re-run: a size is matched by name and its values updated in place,
// so its _id - which products and CompanyMaster.allowedSizes point at - never
// changes. Nothing is deleted.
const SIZES = [
    {
        name: "Size",
        type: "LABEL",
        values: ["Small", "Medium", "Large"]
    }
];

async function seedSizes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const size of SIZES) {
            const result = await SizeMaster.updateOne(
                { name: size.name },
                {
                    $set: size,
                    $setOnInsert: { status: "A" }
                },
                { upsert: true, runValidators: true }
            );

            console.log(
                result.upsertedCount
                    ? `✅ ${size.name} inserted.`
                    : `🔄 ${size.name} updated.`
            );
        }

        console.log("\n🎉 SizeMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedSizes();
