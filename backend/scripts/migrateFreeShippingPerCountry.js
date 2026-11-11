// One-time (safe to re-run) migration: "Free shipping above an order amount"
// moves from one store-wide amount (ShippingPriceSettings.freeAboveThreshold,
// in store currency) to one amount per delivery country
// (ShippingPriceSettings.freeAboveRules, each in that country's currency).
//
// Each vendor's old amount becomes the rule for their STORE country
// (CompanySettings.storeCountryId) - which is where it effectively applied to
// local customers before. It is only carried over when the store country's
// currency IS the store currency (so the number means the same thing);
// otherwise, or when the store country isn't set, the vendor is listed so the
// amounts can be entered by hand on the admin Shipping tab. Every other
// country starts with no free shipping. The old field is then removed.
//
// Run:  node scripts/migrateFreeShippingPerCountry.js            (apply)
//       node scripts/migrateFreeShippingPerCountry.js --dry-run  (report only)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(DRY_RUN ? 'DRY RUN - nothing will be written' : 'Applying migration');
        const db = mongoose.connection.db;
        const settingsCollection = db.collection('shippingpricesettings');

        const legacy = await settingsCollection.find({ freeAboveThreshold: { $gt: 0 } }).toArray();
        let carried = 0;
        const needsManual = [];

        for (const settings of legacy) {
            const companySettings = await db.collection('companysettings').findOne({ vendorId: settings.vendorId });
            const storeCountryId = companySettings?.storeCountryId || null;
            const country = storeCountryId ? await db.collection('countrymasters').findOne({ _id: storeCountryId }) : null;
            const sameCurrency = !!(country?.currency_id && companySettings?.currencyId
                && country.currency_id.toString() === companySettings.currencyId.toString());

            if (!sameCurrency) {
                needsManual.push(`vendor ${settings.vendorId}: old amount ${settings.freeAboveThreshold} (store currency) - ${!country ? 'store country not set' : 'store country currency differs from store currency'}`);
                continue;
            }
            const alreadyHasRule = (settings.freeAboveRules || []).some((r) => r.countryId.toString() === storeCountryId.toString());
            if (alreadyHasRule) continue;

            carried += 1;
            if (!DRY_RUN) {
                await settingsCollection.updateOne(
                    { _id: settings._id },
                    { $push: { freeAboveRules: { countryId: storeCountryId, threshold: settings.freeAboveThreshold } } }
                );
            }
        }

        if (!DRY_RUN) {
            await settingsCollection.updateMany({ freeAboveRules: { $exists: false } }, { $set: { freeAboveRules: [] } });
            await settingsCollection.updateMany({ freeAboveThreshold: { $exists: true } }, { $unset: { freeAboveThreshold: '' } });
        }

        console.log(`Free shipping: ${carried} vendor(s) ${DRY_RUN ? 'would get' : 'got'} their old amount as their store country's amount`);
        if (needsManual.length > 0) {
            console.log('Enter these by hand on the admin Shipping tab:');
            needsManual.forEach((line) => console.log(`  - ${line}`));
        }
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
