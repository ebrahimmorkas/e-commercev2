require("dotenv").config();

const mongoose = require("mongoose");
const UnitMaster = require("../models/UnitMaster");

async function seedUnits() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2s');
        console.log("✅ MongoDB Connected");

        const units = [
            "Centimeter",
            "Meter",
            "Kilogram",
            "Gram",
            "Liter",
            "Milliliter",
            "Piece"
        ];

        for (const name of units) {
            const existingUnit = await UnitMaster.findOne({ name });

            if (existingUnit) {
                console.log(`⚠️ ${name} already exists.`);
                continue;
            }

            await UnitMaster.create({
                name,
                status: "A"
            });

            console.log(`✅ ${name} inserted.`);
        }

        console.log("🎉 UnitMaster seeded successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

seedUnits();