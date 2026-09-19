// One-time (safe to re-run) migration: makes Product's unique indexes ignore
// soft-deleted products - see the LIVE_PRODUCT comment in models/Product.js.
//
// Mongoose never alters an existing index's options, so on a database created
// before that change the old, stricter indexes are still there. This drops
// exactly the six unique indexes whose definition is out of date, then lets
// Mongoose create the new ones. It touches no documents.
//
// Run:  node scripts/migrateProductIndexes.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Product = require('../models/Product');

const UNIQUE_INDEX_NAMES = [
    'vendorId_1_name_1',
    'vendorId_1_slug_1',
    'vendorId_1_productCode_1',
    'vendorId_1_variants.variantCode_1',
    'vendorId_1_variants.sizes.sku_1',
    'variants.sizes.barcode_1'
];

async function migrateProductIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const collection = Product.collection;
        const existing = await collection.indexes();

        for (const name of UNIQUE_INDEX_NAMES) {
            const current = existing.find((index) => index.name === name);
            if (current && !current.partialFilterExpression) {
                await collection.dropIndex(name);
                console.log(`Dropped out-of-date index ${name}`);
            } else if (current) {
                console.log(`Index ${name} already up to date`);
            }
        }

        // Creates whatever is missing (the six above) and no-ops for the rest.
        await Product.createIndexes();

        const after = await collection.indexes();
        for (const name of UNIQUE_INDEX_NAMES) {
            const index = after.find((i) => i.name === name);
            console.log(`${name}: ${index && index.partialFilterExpression ? 'partial OK' : 'MISSING / NOT PARTIAL'}`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error migrating product indexes:', error);
        process.exit(1);
    }
}

migrateProductIndexes();
