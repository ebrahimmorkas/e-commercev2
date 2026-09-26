require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");
const StateMaster = require("../models/StateMaster");
const CityMaster = require("../models/CityMaster");

// Run after seedStateMaster.
//
// The city list lives in data/cityMasterData.json, keyed by country
// (short_country_name) and state (short_state_name) - see its _source block for
// where the data comes from.
//
// Safe to re-run: a city is matched by state + city_name and updated in place
// (its _id never changes). Nothing is deleted.
const cityData = require("./data/cityMasterData.json");

const COUNTRY_KEYS = ["IN", "AE"];

async function seedCityMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const countryShortName of COUNTRY_KEYS) {
            const country = await CountryMaster.findOne({ short_country_name: countryShortName });

            if (!country) {
                throw new Error(`Country ${countryShortName} not found. Please run seedCountryMaster first.`);
            }

            let created = 0;
            let updated = 0;

            for (const [stateShortName, cities] of Object.entries(cityData[countryShortName])) {
                const state = await StateMaster.findOne({
                    country_id: country._id,
                    short_state_name: stateShortName
                });

                if (!state) {
                    throw new Error(`State ${stateShortName} (${countryShortName}) not found. Please run seedStateMaster first.`);
                }

                const operations = cities.map((city) => ({
                    updateOne: {
                        filter: { state_id: state._id, city_name: city.city_name },
                        update: {
                            $set: { short_city_name: city.short_city_name },
                            $setOnInsert: { status: "A" }
                        },
                        upsert: true
                    }
                }));

                const result = await CityMaster.bulkWrite(operations, { ordered: false });

                created += result.upsertedCount;
                updated += result.matchedCount;

                console.log(`   ✅ ${state.state_name}: ${cities.length} cities`);
            }

            console.log(`✅ ${country.country_name}: ${created} cities created, ${updated} updated\n`);
        }

        console.log("🎉 CityMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCityMaster();
