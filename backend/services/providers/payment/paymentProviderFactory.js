const paytabsProvider = require('./paytabsProvider');
const { PAYMENT_GATEWAYS } = require('../../../constants/paymentGatewayConstants');

// Every payment provider adapter implements the same interface:
//   createSession({ order, transaction, returnUrl, callbackUrl }) -> Promise<{ isSuccess, redirectUrl, gatewayTransactionRef, raw }>
//   verifyTransaction({ tranRef, cartId }) -> Promise<{ isSuccess, isPaid, transactionRef, amount, currencyCode, raw }>
//   extractReference(payload) -> { cartId, tranRef }
const providers = {
    [PAYMENT_GATEWAYS.PAYTABS]: paytabsProvider
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
