// Fallback defaults ONLY - every vendor has their own gateway credentials
// (VendorPaymentGatewayCredentials, entered via scripts/
// manageVendorPaymentGatewayCredentials.js), so there is no shared
// profileId/serverKey/clientKey here anymore. This just supplies baseUrl
// when a vendor's own credential record doesn't specify one.
const paymentGatewayConfig = {
    paytabs: {
        defaultBaseUrl: process.env.PAYTABS_BASE_URL || 'https://secure.paytabs.com'
    },
    // Stripe has one single, fixed API host (no per-region variation the way
    // PayTabs has), so this isn't env-overridable - it's a real API
    // endpoint constant, not a business value.
    stripe: {
        defaultBaseUrl: 'https://api.stripe.com'
    }
};

module.exports = paymentGatewayConfig;
