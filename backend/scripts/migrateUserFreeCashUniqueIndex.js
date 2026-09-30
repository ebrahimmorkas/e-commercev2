// One-time (safe to re-run) migration: creates the unique
// { vendorId, freeCashId, userId } index on UserFreeCash (one grant per
// customer per campaign - see models/UserFreeCash.js).
//
// The index can't be built while duplicates exist, so this first lists any
// customer holding more than one grant for the same campaign and stops
// without changing anything - those need a human decision (which balance to
// keep). With no duplicates it builds the index.
//
// Run:  node scripts/migrateUserFreeCashUniqueIndex.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const UserFreeCash = require('../models/UserFreeCash');

async function migrateUserFreeCashUniqueIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const duplicates = await UserFreeCash.collection.aggregate([
            { $group: { _id: { vendorId: '$vendorId', freeCashId: '$freeCashId', userId: '$userId' }, count: { $sum: 1 }, grantIds: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} customer/campaign pair(s) with more than one grant - resolve these first, nothing was changed:`);
            duplicates.forEach((d) => console.log(JSON.stringify(d)));
            await mongoose.disconnect();
            process.exit(1);
        }

        await UserFreeCash.createIndexes();
        const indexes = await UserFreeCash.collection.indexes();
        const unique = indexes.find((i) => i.unique && i.key.vendorId === 1 && i.key.freeCashId === 1 && i.key.userId === 1);
        console.log(unique ? `Unique index ready: ${unique.name}` : 'Unique index NOT found - check the logs above.');

        await mongoose.disconnect();
        process.exit(unique ? 0 : 1);
    } catch (error) {
        console.error('Error creating the UserFreeCash unique index:', error);
        process.exit(1);
    }
}

migrateUserFreeCashUniqueIndex();
