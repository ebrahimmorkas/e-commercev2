const VendorPaymentGatewayCredentials = require('../models/VendorPaymentGatewayCredentials');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Admin-entered - see scripts/manageVendorPaymentGatewayCredentials.js.
// Re-saving resets isActive back to false, since credentials changing means
// they haven't been reconfirmed working yet.
const saveOrUpdateCredentials = async (vendorId, adminUserId, gateway, data) => {
    try {
        if (!data.profileId || !data.serverKey) {
            return common.returnResult(false, 400, 'profileId and serverKey are required.');
        }

        let credentials = await VendorPaymentGatewayCredentials.findOne({ vendorId, gateway });
        if (!credentials) {
            credentials = new VendorPaymentGatewayCredentials({ vendorId, gateway, createdBy: adminUserId });
        }

        credentials.profileId = data.profileId;
        credentials.encryptedServerKey = common.encryptSecret(data.serverKey);
        credentials.encryptedClientKey = data.clientKey ? common.encryptSecret(data.clientKey) : null;
        credentials.baseUrl = data.baseUrl || null;
        credentials.notes = data.notes || null;
        credentials.isActive = false;
        credentials.updatedBy = adminUserId;

        await credentials.save();

        logger.logInfo(1, 0, 'Vendor payment gateway credentials saved', { vendorId, gateway });
        return common.returnResult(true, 200, 'Credentials saved. Run `activate` once you have confirmed a real test payment works.', { credentials: redact(credentials) });
    } catch (err) {
        throw err;
    }
};

// Manual go-live switch - flipped by the platform owner only after they've
// actually confirmed a test payment works end-to-end for this vendor.
const setActive = async (vendorId, adminUserId, gateway, isActive) => {
    try {
        const credentials = await VendorPaymentGatewayCredentials.findOne({ vendorId, gateway });
        if (!credentials) {
            return common.returnResult(false, 404, 'No credentials saved for this vendor yet.');
        }

        credentials.isActive = isActive;
        credentials.updatedBy = adminUserId;
        await credentials.save();

        logger.logInfo(1, 0, 'Vendor payment gateway credentials activation changed', { vendorId, gateway, isActive });
        return common.returnResult(true, 200, `Credentials are now ${isActive ? 'active' : 'inactive'}.`, { credentials: redact(credentials) });
    } catch (err) {
        throw err;
    }
};

// Returns the DECRYPTED credentials for internal use only (paymentService
// building an actual gateway request) - never send this straight back out
// through any controller/API response.
const fetchDecryptedCredentials = async (vendorId, gateway) => {
    try {
        const credentials = await VendorPaymentGatewayCredentials.findOne({ vendorId, gateway, isActive: true });
        if (!credentials) {
            return null;
        }

        return {
            profileId: credentials.profileId,
            serverKey: common.decryptSecret(credentials.encryptedServerKey),
            clientKey: common.decryptSecret(credentials.encryptedClientKey),
            baseUrl: credentials.baseUrl
        };
    } catch (err) {
        throw err;
    }
};

// Redacted view for CLI/log output - never surfaces the encrypted secret
// blobs, let alone plaintext.
const redact = (credentials) => ({
    vendorId: credentials.vendorId,
    gateway: credentials.gateway,
    profileId: credentials.profileId,
    hasServerKey: !!credentials.encryptedServerKey,
    hasClientKey: !!credentials.encryptedClientKey,
    baseUrl: credentials.baseUrl,
    isActive: credentials.isActive,
    notes: credentials.notes
});

const fetchCredentialsSummary = async (vendorId, gateway) => {
    try {
        const credentials = await VendorPaymentGatewayCredentials.findOne({ vendorId, gateway });
        return credentials ? redact(credentials) : null;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    saveOrUpdateCredentials,
    setActive,
    fetchDecryptedCredentials,
    fetchCredentialsSummary
};
