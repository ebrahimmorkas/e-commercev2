// Turns international pricing on for ONE vendor:
//   1. sets CompanyMaster.isIPDetectionFeatureOn + isInternationalPriceFeatureOn = true
//   2. sets CompanyMaster.internationalCurrency to the CurrencyMaster with <currencyCode>
//   3. sets WebsiteMaster.isIPDetectionFeatureOn + isInternationalPriceFeatureOn = true (global switches)
// International pricing also needs the vendor's Store Country (Company
// Settings > General) - the script warns when it is missing. Run
// seeds/seedCurrencyMaster.js first so the currency exists. Safe to re-run.
// Restart the backend afterwards if Redis is off (the vendor data is cached
// in memory), or clear the vendor's company-master / website-master Redis
// keys if it is on.
//   node scripts/enableInternationalPricingForVendor.js <vendorId> [currencyCode, default USD]
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const CurrencyMaster = require('../models/CurrencyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');

const FLAGS = { isIPDetectionFeatureOn: true, isInternationalPriceFeatureOn: true };

async function enableInternationalPricingForVendor() {
    try {
        const vendorId = process.argv[2];
        const currencyCode = (process.argv[3] || 'USD').trim().toUpperCase();
        if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
            throw new Error('Usage: node scripts/enableInternationalPricingForVendor.js <vendorId> [currencyCode]');
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const currency = await CurrencyMaster.findOne({ short_name: currencyCode, status: 'A' });
        if (!currency) {
            throw new Error(`Currency ${currencyCode} not found - run seeds/seedCurrencyMaster.js first.`);
        }

        const company = await CompanyMaster.findOne({ vendorId });
        if (!company) {
            throw new Error(`No CompanyMaster found for vendor ${vendorId}.`);
        }
        Object.assign(company, FLAGS, { internationalCurrency: currency._id });
        await company.save();

        await WebsiteMaster.updateMany({}, { $set: FLAGS });

        const settings = await CompanySettings.findOne({ vendorId }).select('storeCountryId').lean();
        if (!settings?.storeCountryId) {
            process.stdout.write('Warning: this vendor has no Store Country (Company Settings > General) - international pricing stays off until one is set.\n');
        }

        process.stdout.write(`International pricing on for vendor ${vendorId} in ${currencyCode}.\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

enableInternationalPricingForVendor();
