require("dotenv").config();

const mongoose = require("mongoose");

const StateMaster = require("../models/StateMaster");
const CityMaster = require("../models/CityMaster");

async function seedCity() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        const maharashtra = await StateMaster.findOne({
            short_state_name: "MH",
        });

        if (!maharashtra) {
            throw new Error("Maharashtra must be seeded first.");
        }

        const existing = await CityMaster.findOne({
            state_id: maharashtra._id,
            short_city_name: "MUM",
        });

        if (existing) {
            console.log("⚠️ Mumbai already exists.");
            process.exit(0);
        }

        await CityMaster.create({
            state_id: maharashtra._id,
            city_name: "Mumbai",
            short_city_name: "MUM",
            status: "A",
        });

        console.log("✅ Mumbai inserted successfully.");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedCity();