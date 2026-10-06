// Builds every index declared in models/ on the database in MONGODB_URI.
//
// config/dbConfig.js turns autoIndex OFF when NODE_ENV=production, so on a
// brand-new production database none of the unique indexes (product name/SKU,
// user email, ...) exist until this has been run once. Safe to re-run: it only
// creates what is missing, never drops an index and touches no documents.
// Re-run it after any deploy that adds or changes an index in a model.
//
// Run:  node scripts/createAllIndexes.js
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MODELS_DIR = path.join(__dirname, '../models');

async function createAllIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
        console.log('✅ MongoDB Connected');

        const modelFiles = fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js'));
        for (const file of modelFiles) {
            require(path.join(MODELS_DIR, file));
        }

        let failed = 0;
        for (const name of mongoose.modelNames().sort()) {
            try {
                await mongoose.model(name).createIndexes();
                console.log(`✅ ${name}`);
            } catch (error) {
                failed += 1;
                console.error(`❌ ${name}: ${error.message}`);
            }
        }

        console.log(`\nDone: ${mongoose.modelNames().length - failed} model(s) indexed, ${failed} failed.`);
        await mongoose.disconnect();
        process.exit(failed ? 1 : 0);
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        process.exit(1);
    }
}

createAllIndexes();
