// One-time (safe to re-run) migration: makes EmailTemplateMaster's unique
// (vendorId, templateName) index ignore soft-deleted templates - see the index
// comment in models/EmailTemplateMaster.js.
//
// Mongoose never alters an existing index's options, so on a database created
// before that change the old, stricter index is still there. This drops it if
// it is not partial, then lets Mongoose create the new one. It touches no
// documents.
//
// Run:  node scripts/migrateEmailTemplateIndexes.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const EmailTemplateMaster = require('../models/EmailTemplateMaster');

const UNIQUE_INDEX_NAME = 'vendorId_1_templateName_1';

async function migrateEmailTemplateIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const collection = EmailTemplateMaster.collection;
        const existing = await collection.indexes();

        const current = existing.find((index) => index.name === UNIQUE_INDEX_NAME);
        if (current && !current.partialFilterExpression) {
            await collection.dropIndex(UNIQUE_INDEX_NAME);
            console.log(`Dropped out-of-date index ${UNIQUE_INDEX_NAME}`);
        } else if (current) {
            console.log(`Index ${UNIQUE_INDEX_NAME} already up to date`);
        }

        await EmailTemplateMaster.createIndexes();

        const after = await collection.indexes();
        const index = after.find((i) => i.name === UNIQUE_INDEX_NAME);
        console.log(`${UNIQUE_INDEX_NAME}: ${index && index.partialFilterExpression ? 'partial OK' : 'MISSING / NOT PARTIAL'}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error migrating email template indexes:', error);
        process.exit(1);
    }
}

migrateEmailTemplateIndexes();
