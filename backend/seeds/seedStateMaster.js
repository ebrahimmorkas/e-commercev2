require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");
const StateMaster = require("../models/StateMaster");

// Run after seedCountryMaster.
//
// short_state_name: ISO 3166-2 subdivision code (IN-MH -> "MH", AE-DU -> "DU").
// state_code: for India, the GST state code printed on tax invoices (the first
// two digits of a GSTIN); the UAE has no such code, so it repeats the ISO code.
//
// Safe to re-run: a state is matched by country + short_state_name and updated
// in place (its _id never changes). Nothing is deleted.
const STATES = {
    IN: [
        // 28 states
        { state_name: "Andhra Pradesh", short_state_name: "AP", state_code: "37" },
        { state_name: "Arunachal Pradesh", short_state_name: "AR", state_code: "12" },
        { state_name: "Assam", short_state_name: "AS", state_code: "18" },
        { state_name: "Bihar", short_state_name: "BR", state_code: "10" },
        { state_name: "Chhattisgarh", short_state_name: "CT", state_code: "22" },
        { state_name: "Goa", short_state_name: "GA", state_code: "30" },
        { state_name: "Gujarat", short_state_name: "GJ", state_code: "24" },
        { state_name: "Haryana", short_state_name: "HR", state_code: "06" },
        { state_name: "Himachal Pradesh", short_state_name: "HP", state_code: "02" },
        { state_name: "Jharkhand", short_state_name: "JH", state_code: "20" },
        { state_name: "Karnataka", short_state_name: "KA", state_code: "29" },
        { state_name: "Kerala", short_state_name: "KL", state_code: "32" },
        { state_name: "Madhya Pradesh", short_state_name: "MP", state_code: "23" },
        { state_name: "Maharashtra", short_state_name: "MH", state_code: "27" },
        { state_name: "Manipur", short_state_name: "MN", state_code: "14" },
        { state_name: "Meghalaya", short_state_name: "ML", state_code: "17" },
        { state_name: "Mizoram", short_state_name: "MZ", state_code: "15" },
        { state_name: "Nagaland", short_state_name: "NL", state_code: "13" },
        { state_name: "Odisha", short_state_name: "OR", state_code: "21" },
        { state_name: "Punjab", short_state_name: "PB", state_code: "03" },
        { state_name: "Rajasthan", short_state_name: "RJ", state_code: "08" },
        { state_name: "Sikkim", short_state_name: "SK", state_code: "11" },
        { state_name: "Tamil Nadu", short_state_name: "TN", state_code: "33" },
        { state_name: "Telangana", short_state_name: "TG", state_code: "36" },
        { state_name: "Tripura", short_state_name: "TR", state_code: "16" },
        { state_name: "Uttar Pradesh", short_state_name: "UP", state_code: "09" },
        { state_name: "Uttarakhand", short_state_name: "UK", state_code: "05" },
        { state_name: "West Bengal", short_state_name: "WB", state_code: "19" },

        // 8 union territories
        { state_name: "Andaman and Nicobar Islands", short_state_name: "AN", state_code: "35" },
        { state_name: "Chandigarh", short_state_name: "CH", state_code: "04" },
        { state_name: "Dadra and Nagar Haveli and Daman and Diu", short_state_name: "DH", state_code: "26" },
        { state_name: "Delhi", short_state_name: "DL", state_code: "07" },
        { state_name: "Jammu and Kashmir", short_state_name: "JK", state_code: "01" },
        { state_name: "Ladakh", short_state_name: "LA", state_code: "38" },
        { state_name: "Lakshadweep", short_state_name: "LD", state_code: "31" },
        { state_name: "Puducherry", short_state_name: "PY", state_code: "34" }
    ],

    // The 7 emirates
    AE: [
        { state_name: "Abu Dhabi", short_state_name: "AZ", state_code: "AZ" },
        { state_name: "Ajman", short_state_name: "AJ", state_code: "AJ" },
        { state_name: "Dubai", short_state_name: "DU", state_code: "DU" },
        { state_name: "Fujairah", short_state_name: "FU", state_code: "FU" },
        { state_name: "Ras Al Khaimah", short_state_name: "RK", state_code: "RK" },
        { state_name: "Sharjah", short_state_name: "SH", state_code: "SH" },
        { state_name: "Umm Al Quwain", short_state_name: "UQ", state_code: "UQ" }
    ]
};

async function seedStateMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const [countryShortName, states] of Object.entries(STATES)) {
            const country = await CountryMaster.findOne({ short_country_name: countryShortName });

            if (!country) {
                throw new Error(`Country ${countryShortName} not found. Please run seedCountryMaster first.`);
            }

            let created = 0;
            let updated = 0;

            for (const state of states) {
                const result = await StateMaster.updateOne(
                    { country_id: country._id, short_state_name: state.short_state_name },
                    {
                        $set: { ...state, country_id: country._id },
                        $setOnInsert: { status: "A" }
                    },
                    { upsert: true }
                );

                if (result.upsertedCount) created++;
                else updated++;
            }

            console.log(`✅ ${country.country_name}: ${created} states created, ${updated} updated`);
        }

        console.log("\n🎉 StateMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedStateMaster();
