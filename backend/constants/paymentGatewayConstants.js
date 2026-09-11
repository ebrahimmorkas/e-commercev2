// Single source of truth for supported payment gateway keys. Adding a new
// gateway (e.g. an Indian one - Razorpay, PayU, CCAvenue) means: add its key
// here, add its credential block to config/paymentGatewayConfig.js, and add
// its adapter under services/providers/payment/ implementing the same
// interface as paytabsProvider.js. Nothing else in the codebase references a
// gateway name as a literal string - WebsiteMaster.mainPaymentGateway,
// CompanyMaster.paymentGateway and Order.payment.gateway all enum off
// VALID_PAYMENT_GATEWAYS below.
const PAYMENT_GATEWAYS = {
    PAYTABS: 'paytabs',
    STRIPE: 'stripe'
};

const VALID_PAYMENT_GATEWAYS = Object.values(PAYMENT_GATEWAYS);

// How an order actually gets paid for. ONLINE routes through whichever
// gateway resolvePaymentGateway (paymentService.js) picks; COD is settled
// outside the gateway entirely (see isCODFeatureOn).
const PAYMENT_METHODS = {
    ONLINE: 'ONLINE',
    COD: 'COD'
};

const VALID_PAYMENT_METHODS = Object.values(PAYMENT_METHODS);

// Lifecycle of a single PaymentTransaction (one per initiate attempt - a
// customer retrying a failed/abandoned payment produces a new transaction,
// not a mutation of the old one).
const PAYMENT_TRANSACTION_STATUSES = {
    INITIATED: 'INITIATED',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED'
};

const VALID_PAYMENT_TRANSACTION_STATUSES = Object.values(PAYMENT_TRANSACTION_STATUSES);

module.exports = {
    PAYMENT_GATEWAYS,
    VALID_PAYMENT_GATEWAYS,
    PAYMENT_METHODS,
    VALID_PAYMENT_METHODS,
    PAYMENT_TRANSACTION_STATUSES,
    VALID_PAYMENT_TRANSACTION_STATUSES
};
