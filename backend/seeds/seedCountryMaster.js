require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");

// Run order: seedCountryMaster -> seedStateMaster -> seedCityMaster -> seedTaxMaster
// (then seedCurrencyMaster, which links each currency to its country).
//
// Safe to re-run: a country is matched by its ISO 3166-1 alpha-2 code
// (short_country_name) and updated in place, so its _id - which users,
// addresses, company settings and taxes point at - never changes. Nothing
// is deleted, and currency_id / status of an existing row are left alone.
const COUNTRIES = [
    {
        country_name: "India",
        short_country_name: "IN",   // ISO 3166-1 alpha-2
        country_code: "IND",        // ISO 3166-1 alpha-3
        phone_code: "+91"
    },
    {
        country_name: "United Arab Emirates",
        short_country_name: "AE",
        country_code: "ARE",
        phone_code: "+971"
    }
];

async function seedCountryMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const country of COUNTRIES) {
            const result = await CountryMaster.updateOne(
                { short_country_name: country.short_country_name },
                {
                    $set: country,
                    $setOnInsert: { status: "A" }
                },
                { upsert: true }
            );

            console.log(
                result.upsertedCount
                    ? `✅ Country created: ${country.country_name}`
                    : `🔄 Country updated: ${country.country_name}`
            );
        }

        console.log("\n🎉 CountryMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCountryMaster();
