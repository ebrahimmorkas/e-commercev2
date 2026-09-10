// Fallback defaults ONLY - every vendor has their own PayTabs credentials
// (VendorPaymentGatewayCredentials, entered via scripts/
// manageVendorPaymentGatewayCredentials.js), so there is no shared
// profileId/serverKey/clientKey here anymore. This just supplies baseUrl
// when a vendor's own credential record doesn't specify one.
const paymentGatewayConfig = {
    paytabs: {
        defaultBaseUrl: process.env.PAYTABS_BASE_URL || 'https://secure.paytabs.com'
    }
};

module.exports = paymentGatewayConfig;
