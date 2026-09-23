// One-time (safe to re-run) migration: renames the old misspelled audit field
// `inActiveMarkeddBy` (double "d") to `inActiveMarkedBy` - the one spelling
// every model now uses - in the 18 collections whose models had the typo.
//
// For each collection:
//   - documents with only the old field: the field is renamed ($rename);
//   - documents with both (shouldn't happen): the old one is removed and the
//     new one kept as-is;
//   - the old field's index (inActiveMarkeddBy_1) is dropped and the model's
//     new index (inActiveMarkedBy_1) created (nothing else is reindexed).
//
// Run:  node scripts/migrateInActiveMarkedByField.js           (dry run - changes nothing)
//       node scripts/migrateInActiveMarkedByField.js --apply   (renames + reindexes)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const OLD_FIELD = 'inActiveMarkeddBy';
const NEW_FIELD = 'inActiveMarkedBy';
const OLD_INDEX = `${OLD_FIELD}_1`;
const APPLY = process.argv.includes('--apply');

// The models whose schema used the double-d spelling before the rename.
const MODEL_FILES = [
    'BrandMaster', 'Category', 'CommissionLedgerEntry', 'DefaultEmailTemplateMaster',
    'Discount', 'EmailLog', 'EmailTemplateMaster', 'ErrorLog', 'Favorite', 'FreeCash',
    'ImageAsset', 'ModuleMaster', 'PaymentTransaction', 'Review', 'TaxMaster',
    'UserFreeCash', 'VendorPaymentGatewayCredentials', 'VideoAsset'
];

async function migrateInActiveMarkedByField() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        let totalRenamed = 0;

        for (const file of MODEL_FILES) {
            const Model = require(`../models/${file}`);
            const collection = Model.collection;

            const onlyOld = { [OLD_FIELD]: { $exists: true }, [NEW_FIELD]: { $exists: false } };
            const both = { [OLD_FIELD]: { $exists: true }, [NEW_FIELD]: { $exists: true } };
            const [renameCount, bothCount] = await Promise.all([
                collection.countDocuments(onlyOld),
                collection.countDocuments(both)
            ]);

            const indexes = await collection.indexes().catch(() => []);
            const hasOldIndex = indexes.some((index) => index.name === OLD_INDEX);

            if (APPLY) {
                if (renameCount) await collection.updateMany(onlyOld, { $rename: { [OLD_FIELD]: NEW_FIELD } });
                if (bothCount) await collection.updateMany(both, { $unset: { [OLD_FIELD]: '' } });
                if (hasOldIndex) await collection.dropIndex(OLD_INDEX);
                // Only this field's index - Model.createIndexes() would also try to
                // build unrelated indexes, which can fail on unrelated data.
                await collection.createIndex({ [NEW_FIELD]: 1 });
            }

            totalRenamed += renameCount;
            console.log(`${collection.collectionName.padEnd(36)} ${APPLY ? 'renamed' : 'would rename'} ${renameCount}` +
                `${bothCount ? `, ${APPLY ? 'cleaned' : 'would clean'} ${bothCount} with both` : ''}` +
                `${hasOldIndex ? `, ${APPLY ? 'dropped' : 'would drop'} old index` : ''}`);
        }

        console.log(`\n${APPLY ? 'Renamed' : 'Would rename'} the field on ${totalRenamed} document(s).`);
        if (!APPLY) {
            console.log('Dry run only - nothing was changed. Re-run with --apply to migrate.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateInActiveMarkedByField();
