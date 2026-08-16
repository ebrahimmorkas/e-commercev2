require("dotenv").config();

const mongoose = require("mongoose");

const SizeMaster = require("../models/SizeMaster");
const UnitMaster = require("../models/UnitMaster");

async function seedSizes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        // Find units required for measurable sizes
        const centimeter = await UnitMaster.findOne({
            name: "Centimeter"
        });

        const kilogram = await UnitMaster.findOne({
            name: "Kilogram"
        });

        if (!centimeter || !kilogram) {
            throw new Error(
                "Centimeter and Kilogram units must exist in UnitMaster first."
            );
        }

        const sizes = [
            // -------------------------
            // LABEL SIZES
            // -------------------------
            {
                name: "Clothing Size",
                type: "LABEL",
                values: ["L", "XL"],
                status: "A"
            },
            {
                name: "Age Group",
                type: "LABEL",
                values: ["Teenagers", "Senior"],
                status: "A"
            },

            // -------------------------
            // MEASURABLE SIZES
            // -------------------------
            {
                name: "Length",
                type: "MEASURABLE",
                allowedUnits: [centimeter._id],
                status: "A"
            },
            {
                name: "Weight",
                type: "MEASURABLE",
                allowedUnits: [kilogram._id],
                status: "A"
            }
        ];

        for (const size of sizes) {
            const existingSize = await SizeMaster.findOne({
                name: size.name
            });

            if (existingSize) {
                console.log(`⚠️ ${size.name} already exists.`);
                continue;
            }

            await SizeMaster.create(size);

            console.log(`✅ ${size.name} inserted.`);
        }

        console.log("🎉 SizeMaster seeded successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedSizes();