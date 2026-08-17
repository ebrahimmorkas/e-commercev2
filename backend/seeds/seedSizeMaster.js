// seeds/seedSizeMaster.js

require("dotenv").config();

const mongoose = require("mongoose");

const SizeMaster = require("../models/SizeMaster");
const UnitMaster = require("../models/UnitMaster");

async function seedSizes() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce-v2');
        console.log("✅ MongoDB Connected");

        // =========================================================
        // GET UNITS
        // =========================================================

        const centimeter = await UnitMaster.findOne({
            name: "Centimeter"
        });

        const meter = await UnitMaster.findOne({
            name: "Meter"
        });

        const gram = await UnitMaster.findOne({
            name: "Gram"
        });

        const kilogram = await UnitMaster.findOne({
            name: "Kilogram"
        });

        const milliliter = await UnitMaster.findOne({
            name: "Milliliter"
        });

        const liter = await UnitMaster.findOne({
            name: "Liter"
        });

        if (
            !centimeter ||
            !meter ||
            !gram ||
            !kilogram ||
            !milliliter ||
            !liter
        ) {
            throw new Error(
                "Required units are missing. Please run seed-unit-master.js first."
            );
        }

        // =========================================================
        // SIZE MASTER DATA
        // =========================================================

        const sizes = [

            // =====================================================
            // LABEL SIZES
            // =====================================================

            {
                name: "Clothing Size",
                type: "LABEL",
                values: [
                    "XS",
                    "S",
                    "M",
                    "L",
                    "XL",
                    "XXL"
                ],
                status: "A"
            },

            {
                name: "Shoe Size",
                type: "LABEL",
                values: [
                    "6",
                    "7",
                    "8",
                    "9",
                    "10",
                    "11"
                ],
                status: "A"
            },

            {
                name: "Color",
                type: "LABEL",
                values: [
                    "Red",
                    "Blue",
                    "Green",
                    "Black",
                    "White"
                ],
                status: "A"
            },

            {
                name: "Pack Size",
                type: "LABEL",
                values: [
                    "1 Pack",
                    "2 Pack",
                    "5 Pack",
                    "10 Pack"
                ],
                status: "A"
            },

            {
                name: "Age Group",
                type: "LABEL",
                values: [
                    "Kids",
                    "Teenagers",
                    "Adults",
                    "Senior"
                ],
                status: "A"
            },

            // =====================================================
            // MEASURABLE SIZES
            // =====================================================

            // One measurement + one unit
            {
                name: "Simple Length",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Length",
                        allowedUnits: [
                            centimeter._id
                        ]
                    }
                ],
                status: "A"
            },

            // One measurement + multiple units
            {
                name: "Flexible Length",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Length",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    }
                ],
                status: "A"
            },

            // Two measurements + same unit
            {
                name: "Clothing Measurements",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Chest",
                        allowedUnits: [
                            centimeter._id
                        ]
                    },
                    {
                        label: "Waist",
                        allowedUnits: [
                            centimeter._id
                        ]
                    }
                ],
                status: "A"
            },

            // Three measurements + multiple units
            {
                name: "Product Dimensions",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Length",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    },
                    {
                        label: "Width",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    },
                    {
                        label: "Height",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    }
                ],
                status: "A"
            },

            // Weight with multiple units
            {
                name: "Product Weight",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Weight",
                        allowedUnits: [
                            gram._id,
                            kilogram._id
                        ]
                    }
                ],
                status: "A"
            },

            // Volume with multiple units
            {
                name: "Product Volume",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Volume",
                        allowedUnits: [
                            milliliter._id,
                            liter._id
                        ]
                    }
                ],
                status: "A"
            },

            // Mixed measurements
            {
                name: "Package Measurements",
                type: "MEASURABLE",
                measurements: [
                    {
                        label: "Length",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    },
                    {
                        label: "Width",
                        allowedUnits: [
                            centimeter._id,
                            meter._id
                        ]
                    },
                    {
                        label: "Weight",
                        allowedUnits: [
                            gram._id,
                            kilogram._id
                        ]
                    }
                ],
                status: "A"
            }
        ];

        // =========================================================
        // INSERT
        // =========================================================

        for (const size of sizes) {

            const existingSize = await SizeMaster.findOne({
                name: size.name
            });

            if (existingSize) {
                console.log(`⚠️ ${size.name} already exists.`);
                continue;
            }

            await SizeMaster.create(size);

            console.log(`✅ ${size.name} inserted.`);
        }

        console.log(
            "\n🎉 SizeMaster seed completed successfully."
        );

        await mongoose.connection.close();

        process.exit(0);

    } catch (error) {

        console.error("❌ Error:", error);

        await mongoose.connection.close();

        process.exit(1);
    }
}

seedSizes();