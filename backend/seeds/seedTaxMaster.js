require("dotenv").config();

const mongoose = require("mongoose");

const TaxMaster = require("../models/TaxMaster");
const CountryMaster = require("../models/CountryMaster");

async function seedTaxes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2');
        console.log("✅ MongoDB Connected");

        // =========================================================
        // FIND COUNTRIES
        // =========================================================

        const india = await CountryMaster.findOne({
            country_code: "IND"
        });

        const uae = await CountryMaster.findOne({
            country_code: "ARE"
        });

        const usa = await CountryMaster.findOne({
            country_code: "USA"
        });

        if (!india) {
            throw new Error(
                "India not found. Please seed CountryMaster first."
            );
        }

        if (!uae) {
            throw new Error(
                "UAE not found. Please seed CountryMaster first."
            );
        }

        if (!usa) {
            throw new Error(
                "USA not found. Please seed CountryMaster first."
            );
        }

        // =========================================================
        // TAX RECORDS
        // =========================================================

        const taxes = [

            // =====================================================
            // INDIA - GST 18%
            // =====================================================

            {
                name: "GST 18%",
                code: "IN_GST_18",

                countryId: india._id,
                stateId: null,

                hsnCode: null,
                sacCode: null,

                taxType: "percentage",
                totalRate: 18,

                components: [
                    {
                        label: "CGST",
                        rate: 9
                    },
                    {
                        label: "SGST",
                        rate: 9
                    }
                ],

                priceType: "exclusive",

                applicableFrom: new Date(),
                applicableTo: null,

                isDefault: true,
                precedence: 18,

                status: "A"
            },

            // =====================================================
            // UAE - VAT 5%
            // =====================================================

            {
                name: "VAT 5%",
                code: "AE_VAT_5",

                countryId: uae._id,
                stateId: null,

                hsnCode: null,
                sacCode: null,

                taxType: "percentage",
                totalRate: 5,

                components: [],

                priceType: "exclusive",

                applicableFrom: new Date(),
                applicableTo: null,

                isDefault: true,
                precedence: 5,

                status: "A"
            },

            // =====================================================
            // USA - PLACEHOLDER
            // =====================================================
            // USA does not have a single federal sales tax.
            // Actual sales tax should be configured using stateId.
            // Therefore this is NOT marked as default.
            // =====================================================

            {
                name: "US Sales Tax - State Specific",
                code: "US_SALES_TAX_STATE_SPECIFIC",

                countryId: usa._id,
                stateId: null,

                hsnCode: null,
                sacCode: null,

                taxType: "percentage",
                totalRate: 0,

                components: [],

                priceType: "exclusive",

                applicableFrom: new Date(),
                applicableTo: null,

                isDefault: false,
                precedence: 0,

                status: "A"
            }
        ];

        // =========================================================
        // INSERT
        // =========================================================

        for (const tax of taxes) {

            const existingTax = await TaxMaster.findOne({
                code: tax.code
            });

            if (existingTax) {
                console.log(
                    `⚠️ ${tax.code} already exists.`
                );

                continue;
            }

            await TaxMaster.create(tax);

            console.log(
                `✅ ${tax.name} inserted.`
            );
        }

        console.log(
            "\n🎉 TaxMaster seed completed successfully."
        );

        await mongoose.connection.close();

        process.exit(0);

    } catch (error) {

        console.error("❌ Error:", error);

        await mongoose.connection.close();

        process.exit(1);
    }
}

seedTaxes();