// One-time migration for the admin-placed-orders feature.
// Order's {vendorId, cartId} unique index became a PARTIAL index (so orders
// with no cartId - i.e. admin-placed ones - don't collide on null). MongoDB
// refuses to change an existing index's options in place, so drop the old one
// and let Mongoose recreate it. Run once per environment, before deploying:
//   node scripts/migrateOrderCartIdIndex.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function migrateOrderCartIdIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const indexes = await Order.collection.indexes();
        const existing = indexes.find((index) => index.name === 'vendorId_1_cartId_1');
        if (existing && !existing.partialFilterExpression) {
            await Order.collection.dropIndex('vendorId_1_cartId_1');
            console.log('Dropped old vendorId_1_cartId_1 index.');
        } else {
            console.log('No old vendorId_1_cartId_1 index to drop.');
        }

        // createIndexes (not syncIndexes) so this only ever ADDS the new partial
        // index and never drops any other index on the collection.
        await Order.createIndexes();
        console.log('Order indexes created.');

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

migrateOrderCartIdIndex();
