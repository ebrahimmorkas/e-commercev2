require("dotenv").config();

const mongoose = require("mongoose");

const UnitMaster = require("../models/UnitMaster");
const SizeMaster = require("../models/SizeMaster");

async function seedSizes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2');
        console.log("✅ MongoDB Connected");

        const centimeter = await UnitMaster.findOne({
            name: "Centimeter"
        });

        const meter = await UnitMaster.findOne({
            name: "Meter"
        });

        if (!centimeter || !meter) {
            throw new Error(
                "Centimeter and Meter units must exist. Run seed-unit-master.js first."
            );
        }

        const sizes = [
            {
                name: "Length",
                allowedUnits: [centimeter._id, meter._id]
            },
            {
                name: "Breadth",
                allowedUnits: [centimeter._id, meter._id]
            },
            {
                name: "Height",
                allowedUnits: [centimeter._id, meter._id]
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

            await SizeMaster.create({
                name: size.name,
                status: "A",
                allowedUnits: size.allowedUnits
            });

            console.log(`✅ ${size.name} inserted.`);
        }

        console.log("🎉 SizeMaster seeded successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

seedSizes();