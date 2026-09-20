// One-time (safe to re-run) migration for the custom-shipping-price-option work:
//
//  1. Address.isDefault - every user+vendor that already has active addresses
//     but no default gets their most recently added one marked default (new
//     users get theirs automatically on first address). Then builds the
//     partial unique "one default per user" index.
//  2. ShippingPriceSettings "rest" prices - the location/weight/category
//     methods now charge their *RestPrice for anywhere not covered by a rule
//     (previously an unset rest price was null). Unset ones become 0, i.e.
//     "everywhere else ships free", which is what they charged before.
//
//  3. FREE_ABOVE is no longer a shipping method - "free above an amount" is now an
//     optional threshold on top of any method. A vendor still on the FREE_ABOVE
//     method is moved to FIXED using their old "price when below the threshold"
//     (freeAboveFallbackPrice) as the fixed price, keeping their threshold, so
//     their customers see the same prices as before. The retired method is also
//     removed from any vendor's allowedShippingPriceMethods list.
//
// Run:  node scripts/migrateShippingAndDefaultAddress.js            (apply)
//       node scripts/migrateShippingAndDefaultAddress.js --dry-run  (report only)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Address = require('../models/Address');
const ShippingPriceSettings = require('../models/ShippingPriceSettings');

const DRY_RUN = process.argv.includes('--dry-run');

const REST_PRICE_FIELD_BY_METHOD = {
    CATEGORY: 'categoryRestPrice',
    COUNTRY: 'countryRestPrice',
    STATE: 'stateRestPrice',
    CITY: 'cityRestPrice',
    ZIP: 'zipRestPrice',
    WEIGHT: 'weightRestPrice'
};

async function migrateDefaultAddresses() {
    try {
        const usersWithoutDefault = await Address.aggregate([
            { $match: { status: 'A' } },
            { $group: { _id: { userId: '$userId', vendorId: '$vendorId' }, hasDefault: { $max: '$isDefault' } } },
            { $match: { hasDefault: { $ne: true } } }
        ]);

        let updated = 0;
        for (const group of usersWithoutDefault) {
            const { userId, vendorId } = group._id;
            if (DRY_RUN) {
                updated += 1;
                continue;
            }
            const result = await Address.findOneAndUpdate(
                { userId, vendorId, status: 'A' },
                { $set: { isDefault: true } },
                { sort: { createdAt: -1 } }
            );
            if (result) updated += 1;
        }
        console.log(`Addresses: ${updated} user(s) ${DRY_RUN ? 'would get' : 'got'} a default address`);

        if (!DRY_RUN) {
            await Address.createIndexes();
            console.log('Addresses: one-default-per-user index ensured');
        }
    } catch (error) {
        throw error;
    }
}

async function migrateRestPrices() {
    try {
        for (const [method, field] of Object.entries(REST_PRICE_FIELD_BY_METHOD)) {
            const filter = { method, $or: [{ [field]: null }, { [field]: { $exists: false } }] };
            if (DRY_RUN) {
                const count = await ShippingPriceSettings.countDocuments(filter);
                console.log(`Shipping settings (${method}): ${count} document(s) would get ${field} = 0`);
                continue;
            }
            const result = await ShippingPriceSettings.updateMany(filter, { $set: { [field]: 0 } });
            console.log(`Shipping settings (${method}): ${result.modifiedCount} document(s) set ${field} = 0`);
        }
    } catch (error) {
        throw error;
    }
}

async function migrateFreeAboveMethod() {
    try {
        const settings = mongoose.connection.db.collection('shippingpricesettings');
        const companyMasters = mongoose.connection.db.collection('companymasters');

        const legacyCount = await settings.countDocuments({ method: 'FREE_ABOVE' });
        const listCount = await companyMasters.countDocuments({ allowedShippingPriceMethods: 'FREE_ABOVE' });
        if (DRY_RUN) {
            console.log(`Free above: ${legacyCount} shipping setting(s) would move FREE_ABOVE -> FIXED; ${listCount} vendor allow-list(s) would drop FREE_ABOVE`);
            return;
        }

        // Aggregation-pipeline update so the fallback price can be copied into fixedPrice in one step.
        const moved = await settings.updateMany(
            { method: 'FREE_ABOVE' },
            [{ $set: { method: 'FIXED', fixedPrice: { $ifNull: ['$freeAboveFallbackPrice', 0] } } }]
        );
        // The fallback field no longer exists on the model.
        await settings.updateMany({ freeAboveFallbackPrice: { $exists: true } }, { $unset: { freeAboveFallbackPrice: '' } });
        const pulled = await companyMasters.updateMany({ allowedShippingPriceMethods: 'FREE_ABOVE' }, { $pull: { allowedShippingPriceMethods: 'FREE_ABOVE' } });
        console.log(`Free above: ${moved.modifiedCount} shipping setting(s) moved to FIXED; ${pulled.modifiedCount} allow-list(s) cleaned`);
    } catch (error) {
        throw error;
    }
}

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(DRY_RUN ? 'DRY RUN - nothing will be written' : 'Applying migration');
        await migrateDefaultAddresses();
        await migrateRestPrices();
        await migrateFreeAboveMethod();
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
