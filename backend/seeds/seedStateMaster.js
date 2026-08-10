require("dotenv").config();

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");
const StateMaster = require("../models/StateMaster");

async function seedState() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        const india = await CountryMaster.findOne({
            short_country_name: "IN",
        });

        if (!india) {
            throw new Error("India must be seeded first.");
        }

        const existingState = await StateMaster.findOne({
            country_id: india._id,
            short_state_name: "MH",
        });

        if (existingState) {
            console.log("⚠️ Maharashtra already exists.");
            process.exit(0);
        }

        await StateMaster.create({
            country_id: india._id,
            state_name: "Maharashtra",
            short_state_name: "MH",
            state_code: "MH",
            status: "A",
        });

        console.log("✅ Maharashtra inserted successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

seedState();