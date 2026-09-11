const paytabsProvider = require('./paytabsProvider');
const stripeProvider = require('./stripeProvider');
const { PAYMENT_GATEWAYS } = require('../../../constants/paymentGatewayConstants');

// Every payment provider adapter implements the same interface:
//   createSession({ order, transaction, returnUrl, callbackUrl, credentials }) -> Promise<{ isSuccess, redirectUrl, gatewayTransactionRef, raw }>
//   verifyTransaction({ tranRef, cartId, credentials, order }) -> Promise<{ isSuccess, isPaid, transactionRef, amount, currencyCode, raw }>
//   extractReference(payload) -> { cartId, tranRef }
const providers = {
    [PAYMENT_GATEWAYS.PAYTABS]: paytabsProvider,
    [PAYMENT_GATEWAYS.STRIPE]: stripeProvider
};

const getProvider = (gatewayKey) => {
    const provider = providers[gatewayKey];
    if (!provider) {
        throw new Error(`Unsupported payment gateway: ${gatewayKey}`);
    }
    return provider;
};

module.exports = {
    getProvider
};
