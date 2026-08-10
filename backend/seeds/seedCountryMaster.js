require("dotenv").config();

const mongoose = require("mongoose");
const CountryMaster = require("../models/CountryMaster"); // Update path if needed

async function seedCountry() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        const existingCountry = await CountryMaster.findOne({
            short_country_name: "IN",
        });

        if (existingCountry) {
            console.log("⚠️ India already exists.");
            process.exit(0);
        }

        await CountryMaster.create({
            country_name: "India",
            short_country_name: "IN",
            country_code: "IND",
            phone_code: "+91",
            status: "A",
        });

        console.log("✅ India inserted successfully.");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedCountry();