// Manual entry point for commissionService - commission is tracked here,
// not collected automatically through the gateway (the vendor's own PayTabs
// account still receives 100% of every payment). This is the platform
// owner's own tool for seeing what's owed per vendor and marking entries
// collected once payment has actually been arranged separately (invoice,
// bank transfer, etc). No HTTP endpoint, same convention as the other
// platform-owner-only tools in this scripts/ folder.
//
// Usage:
//   node scripts/manageCommissionLedger.js list <vendorId> [status]
//   node scripts/manageCommissionLedger.js collect <entryId> <vendorId> [--notes="..."] [--adminUserId=...]
require('dotenv').config();
const mongoose = require('mongoose');
const commissionService = require('../services/commissionService');
const { VALID_COMMISSION_LEDGER_STATUSES } = require('../constants/commissionConstants');

const parseArgs = (argv) => {
    const result = { _: [] };
    for (const arg of argv) {
        if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            if (eq === -1) {
                result[arg.slice(2)] = true;
            } else {
                result[arg.slice(2, eq)] = arg.slice(eq + 1);
            }
        } else {
            result._.push(arg);
        }
    }
    return result;
};

async function run() {
    try {
        const args = parseArgs(process.argv.slice(2));
        const [command] = args._;

        if (!command) {
            console.log('Usage:');
            console.log('  node scripts/manageCommissionLedger.js list <vendorId> [status]');
            console.log('  node scripts/manageCommissionLedger.js collect <entryId> <vendorId> [--notes="..."] [--adminUserId=...]');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);

        if (command === 'list') {
            const [, vendorId, ledgerStatus] = args._;
            if (!vendorId) {
                console.log('vendorId is required.');
                process.exit(1);
            }
            if (ledgerStatus && !VALID_COMMISSION_LEDGER_STATUSES.includes(ledgerStatus)) {
                console.log(`status must be one of: ${VALID_COMMISSION_LEDGER_STATUSES.join(', ')}`);
                process.exit(1);
            }
            const entries = await commissionService.listByVendor(vendorId, ledgerStatus);
            console.log(`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}:`);
            for (const entry of entries) {
                console.log(`  ${entry._id}  order ${entry.orderNumber}  ${entry.commissionAmount} ${entry.currencyCode}  ${entry.ledgerStatus}`);
            }
            process.exit(0);
        }

        if (command === 'collect') {
            const [, entryId, vendorId] = args._;
            if (!entryId || !vendorId) {
                console.log('entryId and vendorId are required.');
                process.exit(1);
            }
            const result = await commissionService.markCollected(vendorId, args.adminUserId || null, entryId, args.notes);
            console.log(result.message);
            process.exit(result.isSuccess === false ? 1 : 0);
        }

        console.log(`Unknown command: ${command}`);
        process.exit(1);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
