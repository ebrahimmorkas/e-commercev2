// One-time (safe to re-run) migration for product videos.
//
//   websitemasters  - isProductVideoFeatureOn = true and
//                     bulkUploadVideoZipMaxSizeMB = 1024 where missing.
//   companymasters  - isProductVideoFeatureOn = false (each vendor has to be
//                     given it), numberOfVideoUploadAllowedInProduct = null and
//                     sizeOfVideoUploadAllowedInProduct = null (no limit) where missing.
//   companysettings - productVideoPositionInGallery = 1 (videos first) and
//                     isProductVideoAutoplayOn = true where missing.
//   products        - the variants.sizes.videos.videoAssetId index
//                     (autoIndex is off in production).
//
// Vendor data is read cached (and sometimes lean), where a missing field reads
// as off - that is why the WebsiteMaster switch must be written, not left to
// the schema default.
//
// Production: companymasters/websitemasters are read-only for the app's
// database user, so run this with the root URI, then restart the API (vendor
// data is cached).
//
// Run:  node scripts/migrateProductVideoFeature.js           (dry run - changes nothing)
//       node scripts/migrateProductVideoFeature.js --apply   (migrates)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const FIELD_DEFAULTS = {
    websitemasters: {
        isProductVideoFeatureOn: true,
        bulkUploadVideoZipMaxSizeMB: 1024
    },
    companymasters: {
        isProductVideoFeatureOn: false,
        numberOfVideoUploadAllowedInProduct: null,
        sizeOfVideoUploadAllowedInProduct: null
    },
    companysettings: {
        productVideoPositionInGallery: 1,
        isProductVideoAutoplayOn: true
    }
};

const PRODUCT_VIDEO_INDEX = { key: { 'variants.sizes.videos.videoAssetId': 1 }, name: 'variants.sizes.videos.videoAssetId_1' };

async function fillMissingFields(db, collectionName, defaults) {
    try {
        const collection = db.collection(collectionName);
        for (const [field, value] of Object.entries(defaults)) {
            const filter = { [field]: { $exists: false } };
            const count = await collection.countDocuments(filter);
            if (APPLY && count > 0) {
                await collection.updateMany(filter, { $set: { [field]: value } });
            }
            console.log(`${collectionName.padEnd(16)} ${field} ${APPLY ? '' : 'would be '}set to ${JSON.stringify(value)} on ${count}`);
        }
    } catch (err) {
        throw err;
    }
}

async function createProductVideoIndex(db) {
    try {
        const collection = db.collection('products');
        const existing = await collection.indexes();
        if (existing.some((index) => index.name === PRODUCT_VIDEO_INDEX.name)) {
            console.log(`products         index ${PRODUCT_VIDEO_INDEX.name} already exists`);
            return;
        }
        if (APPLY) {
            await collection.createIndex(PRODUCT_VIDEO_INDEX.key, { name: PRODUCT_VIDEO_INDEX.name });
        }
        console.log(`products         index ${PRODUCT_VIDEO_INDEX.name} ${APPLY ? 'created' : 'would be created'}`);
    } catch (err) {
        throw err;
    }
}

async function migrateProductVideoFeature() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;

        for (const [collectionName, defaults] of Object.entries(FIELD_DEFAULTS)) {
            await fillMissingFields(db, collectionName, defaults);
        }
        await createProductVideoIndex(db);

        if (!APPLY) {
            console.log('\nDry run only - nothing was changed. Re-run with --apply to migrate.');
        } else {
            console.log('\nDone. Restart the API so the cached vendor data is reloaded.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateProductVideoFeature();
