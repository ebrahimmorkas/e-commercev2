const mongoose = require('mongoose');
const { VALID_PAYMENT_GATEWAYS } = require('../constants/paymentGatewayConstants');

// Each vendor runs their own independent storefront on their own domain and
// signs up for their own PayTabs (or future gateway) account directly with
// the gateway - their bank account is linked on the gateway's own side, not
// in this app. This model just holds THAT vendor's own API credentials, so
// paymentService can call the gateway "as" the correct vendor for whichever
// domain the order came in on. No split/marketplace logic - every order
// already belongs to exactly one vendor, so there's never more than one
// recipient for a given payment.
//
// Entered/edited by the platform owner only (see scripts/
// manageVendorPaymentGatewayCredentials.js) - no HTTP endpoint, same
// convention as WebsiteMaster/CompanyMaster having no write API.
const vendorPaymentGatewayCredentialsSchema = new mongoose.Schema({
    gateway: {
        type: String,
        enum: VALID_PAYMENT_GATEWAYS,
        required: true
    },
    // PayTabs profile_id - identifies the vendor's merchant profile. Not
    // treated as a secret the way serverKey/clientKey are (PayTabs itself
    // sends it back in webhook payloads), so stored in plain text.
    profileId: {
        type: String,
        required: true,
        trim: true
    },
    // Encrypted with common.js's encryptSecret/decryptSecret (AES-256-GCM,
    // random IV per value) - this is the actual API secret used as the
    // Authorization header on every gateway call, capable of moving real
    // money. Never returned as-is outside paymentService.
    encryptedServerKey: {
        type: String,
        required: true
    },
    // Used for client-side tokenization by some gateways - less sensitive
    // than serverKey but still encrypted for consistency, and optional
    // since not every gateway/integration style needs it.
    encryptedClientKey: {
        type: String,
        default: null
    },
    // Regional API host for this vendor's account (PayTabs' API base URL
    // differs by region, e.g. UAE vs Saudi vs Egypt profiles). Falls back to
    // config/paymentGatewayConfig.js's default when unset.
    baseUrl: {
        type: String,
        trim: true,
        default: null
    },
    // Admin-controlled go-live switch - stays false until the platform owner
    // has actually confirmed these credentials work (e.g. a real sandbox/
    // live test transaction), same gating role onboardingStatus played in
    // the earlier marketplace design. paymentService.initiateOnlinePayment
    // refuses to process a payment for a vendor whose credentials aren't
    // active yet.
    isActive: {
        type: Boolean,
        default: false
    },
    // Free-text admin reference only (e.g. which bank the vendor mentioned
    // linking on their PayTabs account, a contact note) - never parsed or
    // relied on by any payment logic.
    notes: {
        type: String,
        trim: true,
        default: null
    },

    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkeddBy: {
        type: mongoose.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    activeMarkedDate: {
        type: Date,
        default: null
    },
    inactiveMarkedDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

vendorPaymentGatewayCredentialsSchema.index({ vendorId: 1, gateway: 1 }, { unique: true });

module.exports = mongoose.model('VendorPaymentGatewayCredentials', vendorPaymentGatewayCredentialsSchema);
