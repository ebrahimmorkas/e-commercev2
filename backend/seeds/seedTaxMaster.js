require("dotenv").config();

const mongoose = require("mongoose");

const CountryMaster = require("../models/CountryMaster");
const User = require("../models/User");
const TaxMaster = require("../models/TaxMaster");

async function seedTaxes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2');
        console.log("✅ MongoDB Connected");

        const india = await CountryMaster.findOne({
            country_code: "IND"
        });

        if (!india) {
            throw new Error(
                "India not found. Run seed-country-master.js first."
            );
        }

        const admin = await User.findOne({
            email: "admin@example.com"
        });

        if (!admin) {
            throw new Error(
                "Admin user not found. Run seed-user.js first."
            );
        }

        const taxes = [
            {
                name: "GST 5%",
                code: "IN_GST_5",
                totalRate: 5,
                components: [
                    {
                        label: "CGST",
                        rate: 2.5
                    },
                    {
                        label: "SGST",
                        rate: 2.5
                    }
                ],
                isDefault: false,
                precedence: 5
            },
            {
                name: "GST 12%",
                code: "IN_GST_12",
                totalRate: 12,
                components: [
                    {
                        label: "CGST",
                        rate: 6
                    },
                    {
                        label: "SGST",
                        rate: 6
                    }
                ],
                isDefault: false,
                precedence: 12
            },
            {
                name: "GST 18%",
                code: "IN_GST_18",
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
                isDefault: true,
                precedence: 18
            },
            {
                name: "GST 28%",
                code: "IN_GST_28",
                totalRate: 28,
                components: [
                    {
                        label: "CGST",
                        rate: 14
                    },
                    {
                        label: "SGST",
                        rate: 14
                    }
                ],
                isDefault: false,
                precedence: 28
            }
        ];

        for (const tax of taxes) {
            const existingTax = await TaxMaster.findOne({
                code: tax.code
            });

            if (existingTax) {
                console.log(`⚠️ ${tax.code} already exists.`);
                continue;
            }

            await TaxMaster.create({
                name: tax.name,
                code: tax.code,
                countryId: india._id,
                stateId: null,
                hsnCode: null,
                sacCode: null,
                taxType: "percentage",
                totalRate: tax.totalRate,
                components: tax.components,
                priceType: "exclusive",
                applicableFrom: new Date(),
                applicableTo: null,
                isDefault: tax.isDefault,
                precedence: tax.precedence,
                status: "A",
                createdBy: admin._id,
                updatedBy: admin._id
            });

            console.log(`✅ ${tax.name} inserted.`);
        }

        console.log("🎉 TaxMaster seeded successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

seedTaxes();