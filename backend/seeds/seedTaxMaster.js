require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const TaxMaster = require("../models/TaxMaster");
const CountryMaster = require("../models/CountryMaster");

// Run after seedCountryMaster.
//
// Insert-only: a tax whose code already exists is skipped, never updated.
// TaxMaster rows are referenced by products and past orders, so a rate change
// must close the old row (applicableTo) and add a new one - see TaxMaster.js.
//
// All rows are country-wide (stateId null). precedence is the display order.
// priceType is "exclusive" because taxCalculationService always adds the tax
// on top of the line amount.

// ---------------------------------------------------------------------------
// INDIA - GST rate schedule in force since GST 2.0 (22 Sep 2025): 5% and 18%
// standard slabs, 40% for luxury/sin goods, plus the special rates kept for
// precious metals and stones. The 12% and 28% slabs no longer exist.
//
// One row per rate. The rate is identical for intra-state (CGST + SGST, or
// CGST + UTGST in a UT without a legislature) and inter-state (IGST) supplies,
// so the tax amount is right either way; components hold the intra-state
// split. Which split an invoice prints depends on the seller's and buyer's
// states - that is decided when the invoice is made, not by the tax row.
// ---------------------------------------------------------------------------
const GST_FROM = new Date("2025-09-22T00:00:00.000Z");

const gstComponents = (rate) => (
    rate > 0
        ? [{ label: "CGST", rate: rate / 2 }, { label: "SGST", rate: rate / 2 }]
        : []
);

const INDIA_TAXES = [
    { name: "GST 18%", code: "IN_GST_18", totalRate: 18, isDefault: true },
    { name: "GST 5%", code: "IN_GST_5", totalRate: 5 },
    { name: "GST 40%", code: "IN_GST_40", totalRate: 40 },
    { name: "GST 3%", code: "IN_GST_3", totalRate: 3 },                 // gold, silver, platinum, jewellery
    { name: "GST 1.5%", code: "IN_GST_1_5", totalRate: 1.5 },           // cut and polished diamonds
    { name: "GST 0.25%", code: "IN_GST_0_25", totalRate: 0.25 },        // rough diamonds and precious stones
    { name: "GST 0% (Nil Rated)", code: "IN_GST_0", totalRate: 0 },
    { name: "GST Exempt", code: "IN_GST_EXEMPT", totalRate: 0 }
].map((tax, index) => ({
    ...tax,
    components: gstComponents(tax.totalRate),
    applicableFrom: GST_FROM,
    isDefault: tax.isDefault === true,
    precedence: index + 1,
    status: "A"
}));

// ---------------------------------------------------------------------------
// UAE - VAT (since 1 Jan 2018) and Excise Tax.
//
// Excise is paid by the producer/importer and is normally already inside the
// shelf price, so a retailer does not charge it again at checkout. The excise
// rows are therefore seeded Inactive - an admin activates one only for a
// vendor that is itself the excise-registered producer/importer.
//
// Not seeded: excise on sweetened drinks. Since 1 Jan 2026 it is charged per
// litre by sugar content (AED 0.79/L for 5-8g sugar per 100ml, AED 1.09/L for
// 8g+), which a percentage/flat tax row cannot express.
// ---------------------------------------------------------------------------
const UAE_TAXES = [
    { name: "VAT 5%", code: "AE_VAT_5", totalRate: 5, isDefault: true, applicableFrom: "2018-01-01", status: "A" },
    { name: "VAT 0% (Zero Rated)", code: "AE_VAT_0", totalRate: 0, applicableFrom: "2018-01-01", status: "A" },
    { name: "VAT Exempt", code: "AE_VAT_EXEMPT", totalRate: 0, applicableFrom: "2018-01-01", status: "A" },
    { name: "Excise Tax - Tobacco Products 100%", code: "AE_EXCISE_TOBACCO_100", totalRate: 100, applicableFrom: "2017-10-01", status: "I" },
    { name: "Excise Tax - Energy Drinks 100%", code: "AE_EXCISE_ENERGY_DRINKS_100", totalRate: 100, applicableFrom: "2017-10-01", status: "I" },
    { name: "Excise Tax - Electronic Smoking Devices 100%", code: "AE_EXCISE_E_SMOKING_DEVICES_100", totalRate: 100, applicableFrom: "2020-01-01", status: "I" },
    { name: "Excise Tax - Liquids for Electronic Smoking Devices 100%", code: "AE_EXCISE_E_LIQUIDS_100", totalRate: 100, applicableFrom: "2020-01-01", status: "I" }
].map((tax, index) => ({
    ...tax,
    components: [],
    applicableFrom: new Date(`${tax.applicableFrom}T00:00:00.000Z`),
    isDefault: tax.isDefault === true,
    precedence: index + 1
}));

const TAXES_BY_COUNTRY = {
    IN: INDIA_TAXES,
    AE: UAE_TAXES
};

async function seedTaxMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        for (const [countryShortName, taxes] of Object.entries(TAXES_BY_COUNTRY)) {
            const country = await CountryMaster.findOne({ short_country_name: countryShortName });

            if (!country) {
                throw new Error(`Country ${countryShortName} not found. Please run seedCountryMaster first.`);
            }

            for (const tax of taxes) {
                const existingTax = await TaxMaster.findOne({ code: tax.code });

                if (existingTax) {
                    console.log(`⚠️ ${tax.code} already exists - skipped.`);
                    continue;
                }

                await TaxMaster.create({
                    ...tax,
                    countryId: country._id,
                    stateId: null,
                    hsnCode: null,
                    sacCode: null,
                    taxType: "percentage",
                    priceType: "exclusive",
                    applicableTo: null
                });

                console.log(`✅ ${country.country_name}: ${tax.name} inserted.`);
            }
        }

        console.log("\n🎉 TaxMaster seed completed successfully.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);

        await mongoose.connection.close();
        process.exit(1);
    }
}

seedTaxMaster();
