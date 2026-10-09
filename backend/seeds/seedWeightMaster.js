require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const WeightMaster = require("../models/WeightMaster");

async function seedWeights() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Base unit per type (conversionFactor: 1): Gram for MASS, Milliliter
        // for VOLUME. Every other entry's conversionFactor is "how many of
        // that base unit one unit of this entry equals".
        const weights = [
            {
                weightName: "Kilogram",
                weightShortName: "Kilo",
                symbol: "kg",
                type: "MASS",
                conversionFactor: 1000,
                status: "A"
            },
            {
                weightName: "Gram",
                weightShortName: "Gram",
                symbol: "g",
                type: "MASS",
                conversionFactor: 1,
                status: "A"
            },
            {
                weightName: "Milligram",
                weightShortName: "Milli",
                symbol: "mg",
                type: "MASS",
                conversionFactor: 0.001,
                status: "A"
            },
            {
                weightName: "Liter",
                weightShortName: "Liter",
                symbol: "L",
                type: "VOLUME",
                conversionFactor: 1000,
                status: "A"
            },
            {
                weightName: "Milliliter",
                weightShortName: "Milli",
                symbol: "mL",
                type: "VOLUME",
                conversionFactor: 1,
                status: "A"
            }
        ];

        for (const weight of weights) {

            const existingWeight = await WeightMaster.findOne({
                weightName: weight.weightName
            });

            if (existingWeight) {
                continue;
            }

            await WeightMaster.create(weight);

        }


        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {


        await mongoose.connection.close();
        process.exit(1);
    }
}

seedWeights();
