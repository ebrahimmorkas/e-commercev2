// Saves / shows ONE vendor's own storage accounts (Cloudinary / S3 / R2 for
// images, videos and files - CompanyMaster.storageCredentials), picked by the
// vendor's domain. Unlike seeds/seedCompanyMaster.js (which is for
// mouldmarket.in and resets its whole CompanyMaster), this touches nothing
// but that vendor's storageCredentials.
//
// set:
//   1. copy seeds/storageCredentials.example.json to
//      seeds/private/storageCredentials.json (git-ignored - never commit it)
//      and fill in only the areas/providers you want to set. A provider you
//      give replaces that provider's saved account; anything you leave out
//      is kept as it is.
//      Every account needs accountEmail (the email the provider account was
//      created with - for your own reference only) and may have notes.
//   2. make sure CREDENTIALS_ENCRYPTION_KEY is the SAME key the server runs
//      with - the secrets are encrypted with it.
//   3. run the script, then delete seeds/private/storageCredentials.json.
// view: prints which account each area uses (account ids only, never a secret).
//
// Credentials are read straight from the DB on every upload, so no restart is
// needed after a change.
//
// Usage:
//   node scripts/manageVendorStorageCredentials.js set <domain>
//   node scripts/manageVendorStorageCredentials.js view <domain>
// Against another environment's DB, e.g. stage on Render:
//   node --env-file=.env.render scripts/manageVendorStorageCredentials.js set <domain>
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const CompanyMaster = require('../models/CompanyMaster');
const {
    STORAGE_CREDENTIALS_FILE,
    loadStorageCredentialUpdates,
    describeStorageAccounts
} = require('../utils/storageCredentialsFile');

const COMMANDS = ['set', 'view'];

async function run() {
    try {
        const [command, domain] = process.argv.slice(2);
        if (!COMMANDS.includes(command) || !domain) {
            throw new Error('Usage: node scripts/manageVendorStorageCredentials.js <set|view> <domain>');
        }

        // Validated before touching the DB, so a bad file changes nothing.
        let updates = null;
        if (command === 'set') {
            updates = loadStorageCredentialUpdates();
            if (!updates) {
                throw new Error(`${STORAGE_CREDENTIALS_FILE} not found - nothing to save.`);
            }
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: domain.trim().toLowerCase() }).select('_id domain').lean();
        if (!vendor) {
            throw new Error(`Vendor ${domain} not found.`);
        }

        if (command === 'set') {
            const result = await CompanyMaster.updateOne({ vendorId: vendor._id }, { $set: updates }, { runValidators: true });
            if (result.matchedCount === 0) {
                throw new Error(`No CompanyMaster found for ${vendor.domain} - nothing saved.`);
            }
            process.stdout.write(`Storage accounts saved for ${vendor.domain} - delete ${STORAGE_CREDENTIALS_FILE} now.\n`);
        }

        process.stdout.write(`Storage accounts in use for ${vendor.domain}:\n${await describeStorageAccounts(vendor._id)}\n`);
        await mongoose.connection.close();
    } catch (error) {
        process.stderr.write(`manageVendorStorageCredentials failed: ${error.message}\n`);
        await mongoose.connection.close();
        // exitCode, not process.exit(1): pino (loaded via
        // storageCredentialsService) throws if the process is killed while
        // it is still starting.
        process.exitCode = 1;
    }
}

run();
