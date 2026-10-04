const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const mongoose = require('mongoose');

const Vendor = require('../../../models/Vendor');
const User = require('../../../models/User');
const CompanyMaster = require('../../../models/CompanyMaster');
const CompanySettings = require('../../../models/CompanySettings');
const redisService = require('../../../services/redisService');
const { connectRedis, closeRedis } = require('../../../config/redisConfig');
const config = require('../config');

const USAGE = `
Options (shared by every script in this folder):
  --vendor <domain>   Vendor the data is migrated into, e.g. localhost   (required)
  --apply             Actually write. Without it the script is a dry run and writes nothing.
  --limit <n>         Only the first n records of the backup (oldest first).
  --ids <id,id,...>   Only these old _ids (added to --limit when both are given).
  --favorites         03-products only: also take every product that a customer already in the
                      new database had as a favourite (so 06-favorites has something to link).
  --overwrite         Replace records that were already migrated (default: leave them alone).
  --admin <email>     Admin of the vendor recorded as createdBy (default: the vendor's oldest active admin).
  --backup <dir>      Folder holding the .bson files (default: resinArts/backups/resinArts).
`;

// --flag value / --flag pairs into a plain object.
const parseArgs = (argv) => {
    try {
        const args = { apply: false, overwrite: false, favorites: false, limit: null, ids: [], vendor: null, admin: null, backup: null };

        for (let i = 0; i < argv.length; i++) {
            const flag = argv[i];
            if (flag === '--apply') args.apply = true;
            else if (flag === '--overwrite') args.overwrite = true;
            else if (flag === '--favorites') args.favorites = true;
            else if (flag === '--vendor') args.vendor = argv[++i];
            else if (flag === '--admin') args.admin = argv[++i];
            else if (flag === '--backup') args.backup = argv[++i];
            else if (flag === '--limit') args.limit = Number(argv[++i]);
            else if (flag === '--ids') args.ids = String(argv[++i] || '').split(',').map(id => id.trim()).filter(Boolean);
            else throw new Error(`Unknown option "${flag}".${USAGE}`);
        }

        if (!args.vendor) {
            throw new Error(`--vendor <domain> is required.${USAGE}`);
        }
        if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
            throw new Error('--limit must be a whole number of 1 or more.');
        }
        const invalidId = args.ids.find(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidId) {
            throw new Error(`--ids contains "${invalidId}", which is not a valid id.`);
        }

        args.backupDir = args.backup
            ? path.resolve(args.backup)
            : path.resolve(__dirname, '..', config.DEFAULT_BACKUP_DIR);

        return args;
    } catch (err) {
        throw err;
    }
};

// The connection string with any username/password removed - safe to print.
const describeDatabase = (uri) => {
    try {
        return String(uri || '').replace(/\/\/[^@/]*@/, '//<hidden>@');
    } catch (err) {
        throw err;
    }
};

// Connects and resolves everything a migration script needs about its target:
// the vendor, the admin recorded as createdBy, and the vendor's plan/settings.
const openContext = async (scriptName) => {
    try {
        const args = parseArgs(process.argv.slice(2));

        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: args.vendor }).lean();
        if (!vendor) {
            throw new Error(`No vendor with domain "${args.vendor}" in this database. Create the vendor first (seeds/seedVendor.js).`);
        }

        const adminQuery = { vendorId: vendor._id, role: 'admin', status: 'A' };
        if (args.admin) adminQuery.email = args.admin.trim().toLowerCase();
        const admin = await User.findOne(adminQuery).sort({ _id: 1 }).select('_id email').lean();
        if (!admin) {
            throw new Error(args.admin
                ? `No active admin "${args.admin}" for vendor "${args.vendor}".`
                : `Vendor "${args.vendor}" has no active admin. Create one first (seeds/seedUser.js) - migrated records need a real createdBy.`);
        }

        const companyMasterData = await CompanyMaster.findOne({ vendorId: vendor._id }).lean();
        if (!companyMasterData) {
            throw new Error(`Vendor "${args.vendor}" has no CompanyMaster. Run seeds/seedCompanyMaster.js first.`);
        }
        const companySettingsData = await CompanySettings.findOne({ vendorId: vendor._id }).lean();

        console.log('='.repeat(72));
        console.log(`${scriptName}`);
        console.log(`  database : ${describeDatabase(process.env.MONGODB_URI)}`);
        console.log(`  vendor   : ${vendor.domain} (${vendor._id})`);
        console.log(`  backup   : ${args.backupDir}`);
        console.log(`  mode     : ${args.apply ? 'APPLY - records will be written' : 'DRY RUN - nothing will be written (add --apply to write)'}`);
        console.log('='.repeat(72));

        return {
            args,
            vendor,
            vendorId: vendor._id,
            adminId: admin._id,
            companyMasterData,
            companySettingsData
        };
    } catch (err) {
        throw err;
    }
};

// The running backend caches these lists in Redis for an hour, so a script
// that changed one of them has to drop the key or the app keeps serving the
// old list. Does nothing when Redis is switched off.
const invalidateCache = async (keys) => {
    try {
        if (!redisService.isRedisEnabled()) {
            return;
        }
        const client = await connectRedis();
        if (!client) {
            console.log(`  ! Redis is on but could not be reached - clear these keys by hand: ${keys.join(', ')}`);
            return;
        }
        for (const key of keys) {
            await redisService.del(key);
        }
        await closeRedis();
    } catch (err) {
        throw err;
    }
};

// Shared tail of every script: run it, always close the connection, and exit
// non-zero on a failure so a wrapper script can stop at the first broken step.
const run = async (main) => {
    try {
        await main();
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error(`\nMigration stopped: ${err.message}`);
        try {
            await mongoose.connection.close();
        } catch (closeErr) {
            console.error(`Could not close the database connection: ${closeErr.message}`);
        }
        process.exit(1);
    }
};

module.exports = {
    openContext,
    invalidateCache,
    run
};
