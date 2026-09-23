// One-time (safe to re-run) migration: (re)builds BrandMaster's two unique
// indexes as partial indexes over live (Active/Inactive) brands only - see
// models/BrandMaster.js - so a soft-deleted brand no longer reserves its name
// or short name, brands without a short name no longer collide, and brand
// names and short names are unique case-insensitively ("Nike" = "nike").
//
//   vendorId_1_brandName_1       - live brands, case-insensitive collation
//   vendorId_1_brandShortName_1  - live brands that have a short name, case-insensitive collation
//
// Mongoose never alters an existing index's options, so an out-of-date index
// (no partialFilterExpression) is dropped first. Live duplicates would make a
// unique index fail, so they're listed instead of failing half-way. It
// touches no documents.
//
// Run:  node scripts/migrateBrandIndexes.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const BrandMaster = require('../models/BrandMaster');

const LIVE = { status: { $in: ['A', 'I'] } };
const INDEXES = [
    // caseInsensitive: duplicates are looked for ignoring case, and the index must carry the collation.
    { name: 'vendorId_1_brandName_1', field: 'brandName', match: LIVE, caseInsensitive: true },
    { name: 'vendorId_1_brandShortName_1', field: 'brandShortName', match: { brandShortName: { $type: 'string' }, ...LIVE }, caseInsensitive: true }
];

async function migrateBrandIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const collection = BrandMaster.collection;

        let hasDuplicates = false;
        for (const { field, match, caseInsensitive } of INDEXES) {
            const value = caseInsensitive ? { $toLower: `$${field}` } : `$${field}`;
            const duplicates = await collection.aggregate([
                { $match: match },
                { $group: { _id: { vendorId: '$vendorId', value }, brands: { $push: '$brandName' }, count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } }
            ]).toArray();
            duplicates.forEach((d) => {
                hasDuplicates = true;
                console.log(`Live brands share a ${field} - vendor ${d._id.vendorId}: "${d._id.value}" used by ${d.brands.join(', ')}`);
            });
        }
        if (hasDuplicates) {
            console.log('\nCannot build the indexes. Rename or delete one brand of each group above, then re-run.');
            process.exitCode = 1;
            return;
        }

        const existing = await collection.indexes();
        for (const { name, caseInsensitive } of INDEXES) {
            const current = existing.find((index) => index.name === name);
            const missingCollation = caseInsensitive && current?.collation?.strength !== 2;
            if (current && (!current.partialFilterExpression || missingCollation)) {
                await collection.dropIndex(name);
                console.log(`Dropped out-of-date index ${name}`);
            } else if (current) {
                console.log(`Index ${name} already up to date`);
            }
        }

        // Creates whatever is missing (the ones above) and no-ops for the rest.
        await BrandMaster.createIndexes();
        console.log('BrandMaster indexes are up to date.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateBrandIndexes();
