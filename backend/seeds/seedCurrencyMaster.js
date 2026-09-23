require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const CurrencyMaster = require("../models/CurrencyMaster");
const CountryMaster = require("../models/CountryMaster");

// Safe to re-run: each currency is upserted by its code, then linked both
// ways to its country (CurrencyMaster.country_id and CountryMaster.currency_id)
// - which currency a customer sees is looked up through that link
// (services/currencyService.js). A country missing from CountryMaster is
// reported and skipped for the link; the currency is still created.
const CURRENCIES = [
    { name: "Indian Rupee", short_name: "INR", symbol: "₹", symbol_position: "PREFIX", decimal_places: 2, countryName: "India" },
    { name: "US Dollar", short_name: "USD", symbol: "$", symbol_position: "PREFIX", decimal_places: 2, countryName: "United States" },
    { name: "UAE Dirham", short_name: "AED", symbol: "AED", symbol_position: "SUFFIX", decimal_places: 2, countryName: "United Arab Emirates" }
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function seedCurrencyMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const { countryName, ...fields } of CURRENCIES) {
            const country = await CountryMaster.findOne({ country_name: { $regex: `^${escapeRegex(countryName)}$`, $options: "i" } });

            const currency = await CurrencyMaster.findOneAndUpdate(
                { short_name: fields.short_name },
                { $set: { ...fields, status: "A", ...(country ? { country_id: country._id } : {}) } },
                { upsert: true, returnDocument: 'after' }
            );

            if (country) {
                await CountryMaster.updateOne({ _id: country._id }, { $set: { currency_id: currency._id } });
                console.log(`✅ ${fields.short_name} linked to ${country.country_name}`);
            } else {
                console.log(`⚠️  ${fields.short_name} saved, but no country named "${countryName}" was found to link it to`);
            }
        }

        console.log("\n🎉 Currency seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCurrencyMaster();
