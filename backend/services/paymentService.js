const crypto = require('crypto');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentProviderFactory = require('./providers/payment/paymentProviderFactory');
const vendorPaymentGatewayCredentialsService = require('./vendorPaymentGatewayCredentialsService');
const { PAYMENT_METHODS, PAYMENT_TRANSACTION_STATUSES } = require('../constants/paymentGatewayConstants');
const logger = require('../utils/logger');
const common = require('../utils/common');

// WebsiteMaster.mainPaymentGateway (non-null) forces every vendor onto that
// one gateway. Otherwise a vendor uses whichever gateway the platform admin
// assigned it directly on CompanyMaster.paymentGateway - same convention as
// emailService/resolveEmailProvider in emailService.js.
const resolvePaymentGateway = (websiteMasterData, companyMasterData) => {
    try {
        if (websiteMasterData?.mainPaymentGateway) {
            return websiteMasterData.mainPaymentGateway;
        }

        return companyMasterData?.paymentGateway || null;
    } catch (err) {
        throw err;
    }
};

const initiateOnlinePayment = async (vendorId, userId, orderId, vendorDomain, websiteMasterData, companyMasterData) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (order.payment.status === 'PAID') {
            return common.returnResult(false, 409, 'This order has already been paid.');
        }

        const gatewayKey = resolvePaymentGateway(websiteMasterData, companyMasterData);
        if (!gatewayKey) {
            return common.returnResult(false, 500, 'No payment gateway is configured for this store yet. Please contact support.');
        }

        // Each vendor has their own separate gateway account (their own bank
        // account is linked on the gateway's side) - an online payment can't
        // proceed until the platform owner has entered and activated this
        // vendor's own credentials (see
        // scripts/manageVendorPaymentGatewayCredentials.js).
        const credentials = await vendorPaymentGatewayCredentialsService.fetchDecryptedCredentials(vendorId, gatewayKey);
        if (!credentials) {
            return common.returnResult(false, 500, 'This store is not yet set up to receive online payments. Please contact support.');
        }

        const gatewayReferenceId = `PT-${order.orderNumber}-${crypto.randomBytes(4).toString('hex')}`;

        const transaction = new PaymentTransaction({
            orderId: order._id,
            userId,
            vendorId,
            gateway: gatewayKey,
            method: PAYMENT_METHODS.ONLINE,
            gatewayReferenceId,
            transactionStatus: PAYMENT_TRANSACTION_STATUSES.INITIATED,
            amount: order.grandTotal,
            currencyCode: order.currencyCode,
            createdBy: userId,
            updatedBy: userId
        });
        await transaction.save();

        const returnUrl = `https://${vendorDomain}${process.env.PAYMENT_RETURN_PATH || '/checkout/payment-result'}?orderId=${order._id}`;
        const callbackUrl = `https://${vendorDomain}/api/payments/callback/${gatewayKey}`;

        const provider = paymentProviderFactory.getProvider(gatewayKey);
        const sessionResult = await provider.createSession({ order, transaction, returnUrl, callbackUrl, credentials });

        if (!sessionResult.isSuccess) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = sessionResult.message || 'Gateway did not return a payment session.';
            transaction.rawInitiateResponse = sessionResult.raw || null;
            await transaction.save();
            logger.logInfo(0, 1, 'Payment gateway failed to create a session', { vendorId, orderId, gatewayKey });
            return common.returnResult(false, 502, 'Unable to initiate payment with the gateway. Please try again.');
        }

        transaction.redirectUrl = sessionResult.redirectUrl;
        transaction.gatewayTransactionRef = sessionResult.gatewayTransactionRef || null;
        transaction.rawInitiateResponse = sessionResult.raw || null;
        await transaction.save();

        order.payment.method = PAYMENT_METHODS.ONLINE;
        order.payment.gateway = gatewayKey;
        await order.save();

        logger.logInfo(1, 0, 'Payment session created', { vendorId, orderId, gatewayKey, transactionId: transaction._id });
        return common.returnResult(true, 200, 'Payment session created successfully.', { redirectUrl: sessionResult.redirectUrl, transactionId: transaction._id });
    } catch (err) {
        throw err;
    }
};

const selectCashOnDelivery = async (vendorId, userId, orderId) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (order.payment.status === 'PAID') {
            return common.returnResult(false, 409, 'This order has already been paid.');
        }

        order.payment.method = PAYMENT_METHODS.COD;
        order.payment.gateway = null;
        order.updatedBy = userId;
        await order.save();

        logger.logInfo(1, 0, 'Cash on Delivery selected for order', { vendorId, orderId });
        return common.returnResult(true, 200, 'Cash on Delivery selected for this order.', { order });
    } catch (err) {
        throw err;
    }
};

// Processes a gateway callback (IPN). Deliberately never trusts the posted
// payload's own status fields - re-queries the gateway server-to-server via
// verifyTransaction before marking anything paid. Idempotent: a transaction
// that isn't still INITIATED is treated as already-processed and returns
// success without re-applying the result, so a redelivered IPN is a safe
// no-op instead of double-crediting/erroring the order.
const handleGatewayCallback = async (vendorId, gatewayKey, rawPayload) => {
    try {
        const provider = paymentProviderFactory.getProvider(gatewayKey);
        const { cartId, tranRef } = provider.extractReference(rawPayload);

        if (!cartId) {
            return common.returnResult(false, 400, 'Missing cart reference in callback payload.');
        }

        const transaction = await PaymentTransaction.findOne({ vendorId, gatewayReferenceId: cartId });
        if (!transaction) {
            return common.returnResult(false, 404, 'Payment transaction not found.');
        }

        if (transaction.transactionStatus !== PAYMENT_TRANSACTION_STATUSES.INITIATED) {
            logger.logInfo(1, 0, 'Duplicate payment callback ignored', { vendorId, transactionId: transaction._id });
            return common.returnResult(true, 200, 'Callback already processed.');
        }

        const credentials = await vendorPaymentGatewayCredentialsService.fetchDecryptedCredentials(vendorId, gatewayKey);
        if (!credentials) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = 'No active gateway credentials found for this vendor.';
            await transaction.save();
            return common.returnResult(false, 500, 'No active gateway credentials found for this vendor.');
        }

        const verifyResult = await provider.verifyTransaction({ tranRef: transaction.gatewayTransactionRef || tranRef, cartId, credentials });
        transaction.rawCallbackResponse = rawPayload;

        if (!verifyResult.isSuccess) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = verifyResult.message || 'Gateway verification failed.';
            await transaction.save();
            return common.returnResult(false, 502, 'Unable to verify payment with the gateway.');
        }

        const order = await Order.findOne({ _id: transaction.orderId, vendorId });
        if (!order) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = 'Order not found for this transaction.';
            await transaction.save();
            return common.returnResult(false, 404, 'Order not found for this transaction.');
        }

        // Guard against a gateway returning a paid result for the wrong
        // amount/currency (tampered callback, mismatched profile, etc).
        if (verifyResult.isPaid && (Number(verifyResult.amount) !== transaction.amount || verifyResult.currencyCode !== transaction.currencyCode)) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = 'Amount/currency mismatch between transaction and gateway verification.';
            order.payment.status = 'FAILED';
            await transaction.save();
            await order.save();
            logger.logInfo(0, 1, 'Payment amount/currency mismatch detected', { vendorId, orderId: order._id, transactionId: transaction._id });
            return common.returnResult(false, 502, 'Payment amount mismatch detected.');
        }

        if (verifyResult.isPaid) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.SUCCESS;
            order.payment.status = 'PAID';
            order.payment.transactionId = verifyResult.transactionRef;
            order.payment.amount = verifyResult.amount;
            order.payment.paidAt = new Date();
        } else {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = verifyResult.statusMessage || 'Payment not completed.';
            order.payment.status = 'FAILED';
        }

        await transaction.save();
        await order.save();

        logger.logInfo(1, 0, 'Payment callback processed', { vendorId, orderId: order._id, transactionId: transaction._id, isPaid: verifyResult.isPaid });
        return common.returnResult(true, 200, 'Callback processed successfully.');
    } catch (err) {
        throw err;
    }
};

const getPaymentStatus = async (vendorId, userId, orderId) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } }, 'payment orderNumber grandTotal currencyCode');
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        const latestTransaction = await PaymentTransaction.findOne({ vendorId, orderId }).sort({ createdAt: -1 });

        return common.returnResult(true, 200, 'Payment status fetched successfully.', { payment: order.payment, transaction: latestTransaction });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    initiateOnlinePayment,
    selectCashOnDelivery,
    handleGatewayCallback,
    getPaymentStatus
};
