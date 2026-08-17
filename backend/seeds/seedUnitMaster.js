require("dotenv").config();

const mongoose = require("mongoose");
const UnitMaster = require("../models/UnitMaster");

async function seedUnits() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/ecommerce-v2");
        console.log("✅ MongoDB Connected");

        const units = [
            {
                name: "Centimeter",
                status: "A"
            },
            {
                name: "Meter",
                status: "A"
            },
            {
                name: "Millimeter",
                status: "A"
            },
            {
                name: "Kilogram",
                status: "A"
            },
            {
                name: "Gram",
                status: "A"
            },
            {
                name: "Milligram",
                status: "A"
            },
            {
                name: "Liter",
                status: "A"
            },
            {
                name: "Milliliter",
                status: "A"
            },
            {
                name: "Piece",
                status: "A"
            }
        ];

        for (const unit of units) {

            const existingUnit = await UnitMaster.findOne({
                name: unit.name
            });

            if (existingUnit) {
                console.log(`⚠️ ${unit.name} already exists.`);
                continue;
            }

            await UnitMaster.create(unit);

            console.log(`✅ ${unit.name} inserted.`);
        }

        console.log("\n🎉 UnitMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {

        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedUnits();