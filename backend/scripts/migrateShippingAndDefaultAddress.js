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

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(DRY_RUN ? 'DRY RUN - nothing will be written' : 'Applying migration');
        await migrateDefaultAddresses();
        await migrateRestPrices();
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
