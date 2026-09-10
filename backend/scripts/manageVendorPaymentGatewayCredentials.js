// Manual entry point for vendorPaymentGatewayCredentialsService - each
// vendor runs their own storefront on their own domain and signs up for
// their own PayTabs account directly with PayTabs (linking their own bank
// account on PayTabs' side). This is the platform owner's own tool for
// recording that vendor's profile_id/server_key/client_key so the app can
// call PayTabs "as" the correct vendor. There is no HTTP endpoint for this
// (same convention as WebsiteMaster/CompanyMaster having no write API).
//
// Usage:
//   node scripts/manageVendorPaymentGatewayCredentials.js set <vendorId> [gateway] --profileId=... --serverKey=... [--clientKey=...] [--baseUrl=...] [--notes="..."] [--adminUserId=...]
//   node scripts/manageVendorPaymentGatewayCredentials.js activate <vendorId> [gateway] [--adminUserId=...]
//   node scripts/manageVendorPaymentGatewayCredentials.js deactivate <vendorId> [gateway] [--adminUserId=...]
//   node scripts/manageVendorPaymentGatewayCredentials.js view <vendorId> [gateway]
//
// gateway defaults to "paytabs" if omitted. `activate` only after you've
// actually confirmed a real test payment works for that vendor - until then
// paymentService refuses to initiate online payments for them.
require('dotenv').config();
const mongoose = require('mongoose');
const vendorPaymentGatewayCredentialsService = require('../services/vendorPaymentGatewayCredentialsService');
const { PAYMENT_GATEWAYS } = require('../constants/paymentGatewayConstants');

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
        const [command, vendorId, gatewayArg] = args._;
        const gateway = gatewayArg || PAYMENT_GATEWAYS.PAYTABS;

        if (!command || !vendorId) {
            console.log('Usage: node scripts/manageVendorPaymentGatewayCredentials.js <set|activate|deactivate|view> <vendorId> [gateway] [--flags]');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);

        let result;
        if (command === 'set') {
            result = await vendorPaymentGatewayCredentialsService.saveOrUpdateCredentials(vendorId, args.adminUserId || null, gateway, {
                profileId: args.profileId,
                serverKey: args.serverKey,
                clientKey: args.clientKey,
                baseUrl: args.baseUrl,
                notes: args.notes
            });
        } else if (command === 'activate') {
            result = await vendorPaymentGatewayCredentialsService.setActive(vendorId, args.adminUserId || null, gateway, true);
        } else if (command === 'deactivate') {
            result = await vendorPaymentGatewayCredentialsService.setActive(vendorId, args.adminUserId || null, gateway, false);
        } else if (command === 'view') {
            const summary = await vendorPaymentGatewayCredentialsService.fetchCredentialsSummary(vendorId, gateway);
            result = { isSuccess: !!summary, message: summary ? 'Found.' : 'No credentials saved for this vendor yet.', meta: { credentials: summary } };
        } else {
            console.log(`Unknown command: ${command}`);
            process.exit(1);
        }

        console.log(result.message);
        if (result.meta?.credentials) {
            console.log(JSON.stringify(result.meta.credentials, null, 2));
        }

        process.exit(result.isSuccess === false ? 1 : 0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
