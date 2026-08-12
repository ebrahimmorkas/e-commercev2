require("dotenv").config();

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");
const StateMaster = require("../models/StateMaster");
const CityMaster = require("../models/CityMaster");

async function seedCountryStateCity() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2');
        console.log("✅ MongoDB Connected");

        const data = [
            {
                country_name: "India",
                short_country_name: "IN",
                country_code: "IND",
                phone_code: "+91",
                states: [
                    {
                        state_name: "Maharashtra",
                        short_state_name: "MH",
                        state_code: "MH",
                        cities: [
                            {
                                city_name: "Mumbai",
                                short_city_name: "MUM",
                            },
                            {
                                city_name: "Pune",
                                short_city_name: "PUN",
                            },
                            {
                                city_name: "Nagpur",
                                short_city_name: "NAG",
                            },
                        ],
                    },
                    {
                        state_name: "Gujarat",
                        short_state_name: "GJ",
                        state_code: "GJ",
                        cities: [
                            {
                                city_name: "Ahmedabad",
                                short_city_name: "AMD",
                            },
                            {
                                city_name: "Surat",
                                short_city_name: "SRT",
                            },
                            {
                                city_name: "Vadodara",
                                short_city_name: "VAD",
                            },
                        ],
                    },
                    {
                        state_name: "Karnataka",
                        short_state_name: "KA",
                        state_code: "KA",
                        cities: [
                            {
                                city_name: "Bengaluru",
                                short_city_name: "BLR",
                            },
                            {
                                city_name: "Mysuru",
                                short_city_name: "MYS",
                            },
                            {
                                city_name: "Mangaluru",
                                short_city_name: "MNG",
                            },
                        ],
                    },
                ],
            },

            {
                country_name: "United States",
                short_country_name: "US",
                country_code: "USA",
                phone_code: "+1",
                states: [
                    {
                        state_name: "California",
                        short_state_name: "CA",
                        state_code: "CA",
                        cities: [
                            {
                                city_name: "Los Angeles",
                                short_city_name: "LA",
                            },
                            {
                                city_name: "San Francisco",
                                short_city_name: "SF",
                            },
                            {
                                city_name: "San Diego",
                                short_city_name: "SD",
                            },
                        ],
                    },
                    {
                        state_name: "Texas",
                        short_state_name: "TX",
                        state_code: "TX",
                        cities: [
                            {
                                city_name: "Houston",
                                short_city_name: "HOU",
                            },
                            {
                                city_name: "Dallas",
                                short_city_name: "DAL",
                            },
                            {
                                city_name: "Austin",
                                short_city_name: "AUS",
                            },
                        ],
                    },
                    {
                        state_name: "New York",
                        short_state_name: "NY",
                        state_code: "NY",
                        cities: [
                            {
                                city_name: "New York City",
                                short_city_name: "NYC",
                            },
                            {
                                city_name: "Buffalo",
                                short_city_name: "BUF",
                            },
                            {
                                city_name: "Rochester",
                                short_city_name: "ROC",
                            },
                        ],
                    },
                ],
            },

            {
                country_name: "United Arab Emirates",
                short_country_name: "AE",
                country_code: "ARE",
                phone_code: "+971",
                states: [
                    {
                        state_name: "Dubai",
                        short_state_name: "DU",
                        state_code: "DU",
                        cities: [
                            {
                                city_name: "Dubai",
                                short_city_name: "DXB",
                            },
                            {
                                city_name: "Hatta",
                                short_city_name: "HTA",
                            },
                            {
                                city_name: "Jebel Ali",
                                short_city_name: "JEA",
                            },
                        ],
                    },
                    {
                        state_name: "Abu Dhabi",
                        short_state_name: "AD",
                        state_code: "AD",
                        cities: [
                            {
                                city_name: "Abu Dhabi",
                                short_city_name: "AUH",
                            },
                            {
                                city_name: "Al Ain",
                                short_city_name: "AAN",
                            },
                            {
                                city_name: "Madinat Zayed",
                                short_city_name: "MZY",
                            },
                        ],
                    },
                    {
                        state_name: "Sharjah",
                        short_state_name: "SH",
                        state_code: "SH",
                        cities: [
                            {
                                city_name: "Sharjah",
                                short_city_name: "SHJ",
                            },
                            {
                                city_name: "Khor Fakkan",
                                short_city_name: "KFK",
                            },
                            {
                                city_name: "Kalba",
                                short_city_name: "KLB",
                            },
                        ],
                    },
                ],
            },
        ];

        for (const countryData of data) {
            // -----------------------------
            // COUNTRY
            // -----------------------------
            let country = await CountryMaster.findOne({
                country_code: countryData.country_code,
            });

            if (!country) {
                country = await CountryMaster.create({
                    country_name: countryData.country_name,
                    short_country_name: countryData.short_country_name,
                    country_code: countryData.country_code,
                    phone_code: countryData.phone_code,
                    status: "A",
                });

                console.log(
                    `✅ Country created: ${countryData.country_name}`
                );
            } else {
                console.log(
                    `⚠️ Country already exists: ${countryData.country_name}`
                );
            }

            // -----------------------------
            // STATES
            // -----------------------------
            for (const stateData of countryData.states) {
                let state = await StateMaster.findOne({
                    country_id: country._id,
                    state_code: stateData.state_code,
                });

                if (!state) {
                    state = await StateMaster.create({
                        country_id: country._id,
                        state_name: stateData.state_name,
                        short_state_name: stateData.short_state_name,
                        state_code: stateData.state_code,
                        status: "A",
                    });

                    console.log(
                        `   ✅ State created: ${stateData.state_name}`
                    );
                } else {
                    console.log(
                        `   ⚠️ State already exists: ${stateData.state_name}`
                    );
                }

                // -----------------------------
                // CITIES
                // -----------------------------
                for (const cityData of stateData.cities) {
                    const existingCity = await CityMaster.findOne({
                        state_id: state._id,
                        short_city_name: cityData.short_city_name,
                    });

                    if (!existingCity) {
                        await CityMaster.create({
                            state_id: state._id,
                            city_name: cityData.city_name,
                            short_city_name: cityData.short_city_name,
                            status: "A",
                        });

                        console.log(
                            `      ✅ City created: ${cityData.city_name}`
                        );
                    } else {
                        console.log(
                            `      ⚠️ City already exists: ${cityData.city_name}`
                        );
                    }
                }
            }
        }

        console.log("\n🎉 Country, State and City seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCountryStateCity();