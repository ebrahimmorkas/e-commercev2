require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const UnitMaster = require("../models/UnitMaster");

async function seedUnits() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

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
                continue;
            }

            await UnitMaster.create(unit);

        }


        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {


        await mongoose.connection.close();
        process.exit(1);
    }
}

seedUnits();