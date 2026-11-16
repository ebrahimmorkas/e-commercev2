const crypto = require('crypto');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentProviderFactory = require('./providers/payment/paymentProviderFactory');
const vendorPaymentGatewayCredentialsService = require('./vendorPaymentGatewayCredentialsService');
const { PAYMENT_METHODS, PAYMENT_TRANSACTION_STATUSES } = require('../constants/paymentGatewayConstants');
const { ORDER_NOTIFICATION_TYPES } = require('../constants/orderRealtimeConstants');
const { notifyOrderChanged } = require('./orderRealtimeService');
const bankFieldTemplateService = require('./bankFieldTemplateService');
const platformAlertService = require('./platformAlertService');
const User = require('../models/User');
const {
    CHECKOUT_ISSUE_REASON_TEXT,
    CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES
} = require('../constants/checkoutIssueConstants');
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

const initiateOnlinePayment = async (vendorId, userId, orderId, vendorDomain, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (order.payment.status === 'PAID') {
            return common.returnResult(false, 409, 'This order has already been paid.');
        }

        // Manual shipping not entered yet - the total is still incomplete, so
        // paying now would under-charge. Cash on delivery isn't blocked.
        if (order.shippingPriceBreakdown?.isShippingPending) {
            return common.returnResult(false, 409, 'The store has not confirmed the shipping charge for this order yet. Please pay once it is added.');
        }

        // Sits below the WebsiteMaster/CompanyMaster admin-level entitlement
        // gate (already checked in paymentController before this is called)
        // - this is the vendor's OWN on/off switch for online payment on
        // their storefront (e.g. their gateway subscription lapsed), same
        // "show" toggle convention as showAnnouncements/showBanners/
        // showReviewsToCustomers in CompanySettings.
        if (companySettingsData?.isPaymentGatewayFeatureOn === false) {
            return common.returnResult(false, 403, 'Online payment is currently unavailable for this store.');
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

        // Encoded here (not left to the controller) since this URL is handed
        // straight to the gateway and the browser lands on it directly after
        // payment - the raw order _id must never appear in that redirect.
        const returnUrl = `https://${vendorDomain}${process.env.PAYMENT_RETURN_PATH || '/checkout/payment-result'}?orderId=${common.encodeId(order._id)}`;
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
        notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED);

        logger.logInfo(1, 0, 'Payment session created', { vendorId, orderId, gatewayKey, transactionId: transaction._id });
        return common.returnResult(true, 200, 'Payment session created successfully.', { redirectUrl: sessionResult.redirectUrl, transactionId: transaction._id });
    } catch (err) {
        throw err;
    }
};

const selectCashOnDelivery = async (vendorId, userId, orderId, companySettingsData = null) => {
    try {
        if (companySettingsData?.isCODFeatureOn === false) {
            return common.returnResult(false, 403, 'Cash on Delivery is not available for this store.');
        }

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
        notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED);

        logger.logInfo(1, 0, 'Cash on Delivery selected for order', { vendorId, orderId });
        return common.returnResult(true, 200, 'Cash on Delivery selected for this order.', { order });
    } catch (err) {
        throw err;
    }
};

// What the checkout can offer: Cash on Delivery (the two-level isCODFeatureOn
// gate) and "pay online" by QR / bank transfer, with the details the vendor
// filled in Company Settings (gated by the same two-level flag that gates
// editing them). Customer-only - the bank details are never in the public
// storefront settings.
const getCheckoutPaymentOptions = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const codCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isCODFeatureOn', 'isCODFeatureOn');
        const detailsCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData,
            'isShowingPaymentQRCodeAndBankDetailsFeatureOn', 'showPaymentQRCodeAndBankDetails'
        );

        const gpayCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData,
            'isShowingGpayNumberFeatureOn', 'showGpayNumber'
        );

        const settings = companySettingsData || {};
        // QR + bank and GPay are separate entitlements: a missing one hides only its own part.
        const scannerUrl = detailsCheck.isSuccess ? (settings.paymentScanner?.url || null) : null;
        // The store country's bank fields that are filled in: [{ key, label, value }] or null.
        const bankFields = detailsCheck.isSuccess
            ? await bankFieldTemplateService.resolveBankDetailsForDisplay(settings)
            : null;
        const bank = bankFields ? { fields: bankFields } : null;
        const hasBankDetails = !!bank;
        const gpayNumber = gpayCheck.isSuccess ? (settings.gpayNumber || null) : null;
        const onlineEnabled = !!scannerUrl || hasBankDetails || !!gpayNumber;

        return common.returnResult(true, 200, 'Payment options fetched successfully', {
            // WebsiteMaster + CompanyMaster entitlement AND the vendor's own CompanySettings switch.
            cod: codCheck.isSuccess && settings.isCODFeatureOn !== false,
            online: onlineEnabled
                ? {
                    scannerUrl,
                    bank: hasBankDetails ? bank : null,
                    gpayNumber,
                    whatsappNumber: settings.adminWhatsappNumber || null,
                    companyName: settings.companyName || null
                }
                : null
        });
    } catch (err) {
        throw err;
    }
};

// The customer chose to pay by QR / bank transfer: records ONLINE with no
// gateway on the order (nothing is charged here - the admin confirms the money
// arrived and marks it paid). Re-checks that the vendor really offers it.
const selectManualTransfer = async (vendorId, userId, orderId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const options = await getCheckoutPaymentOptions(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!options.meta.online) {
            return common.returnResult(false, 403, 'Paying by QR / bank transfer is not available for this store.');
        }

        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (order.payment.status === 'PAID') {
            return common.returnResult(false, 409, 'This order has already been paid.');
        }

        order.payment.method = PAYMENT_METHODS.ONLINE;
        order.payment.gateway = null;
        order.updatedBy = userId;
        await order.save();
        notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED);

        logger.logInfo(1, 0, 'QR / bank transfer selected for order', { vendorId, orderId });
        return common.returnResult(true, 200, 'Pay by QR / bank transfer selected for this order.', { order });
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

        const order = await Order.findOne({ _id: transaction.orderId, vendorId });
        if (!order) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = 'Order not found for this transaction.';
            await transaction.save();
            return common.returnResult(false, 404, 'Order not found for this transaction.');
        }

        // order is passed through so a provider whose amounts come back in
        // the smallest currency unit (e.g. Stripe's cents) can convert using
        // this exact order's own currencyDecimalPlaces snapshot - PayTabs
        // ignores it, since its amounts are already plain decimals.
        const verifyResult = await provider.verifyTransaction({ tranRef: transaction.gatewayTransactionRef || tranRef, cartId, credentials, order });
        transaction.rawCallbackResponse = rawPayload;

        if (!verifyResult.isSuccess) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = verifyResult.message || 'Gateway verification failed.';
            await transaction.save();
            return common.returnResult(false, 502, 'Unable to verify payment with the gateway.');
        }

        // Guard against a gateway returning a paid result for the wrong
        // amount/currency (tampered callback, mismatched profile, etc).
        if (verifyResult.isPaid && (Number(verifyResult.amount) !== transaction.amount || verifyResult.currencyCode !== transaction.currencyCode)) {
            transaction.transactionStatus = PAYMENT_TRANSACTION_STATUSES.FAILED;
            transaction.failureReason = 'Amount/currency mismatch between transaction and gateway verification.';
            order.payment.status = 'FAILED';
            await transaction.save();
            await order.save();
            notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED);
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
        notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.PAYMENT_UPDATED);

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

// Placing an order from checkout needs a way to pay: Cash on Delivery, or
// the QR / bank details / GPay. With neither, the order is refused (409)
// instead of being created with no payment method - which the customer took
// for a COD order. (The storefront never uses the payment gateway at checkout.)
const checkCustomerCanPay = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const options = await getCheckoutPaymentOptions(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!options.isSuccess) return options;
        if (!options.meta.cod && !options.meta.online) {
            return common.returnResult(false, 409, "This store can't take payment right now, so the order can't be placed. Please try again later or report the problem.");
        }
        return common.returnResult(true, 200, 'A payment option is available');
    } catch (err) {
        throw err;
    }
};

// Last report time per customer ("vendorId:userId" -> ms), so one customer
// can't flood the platform owner's inbox. In memory: a restart resets it,
// which is fine for a spam guard.
const lastCheckoutIssueReportAt = new Map();

const forgetOldReports = (now, cooldownMs) => {
    try {
        for (const [key, time] of lastCheckoutIssueReportAt) {
            if (now - time >= cooldownMs) lastCheckoutIssueReportAt.delete(key);
        }
    } catch (err) {
        throw err;
    }
};

// What the server sees right now - so the email says whether the problem is
// still there, and the real error when loading the options breaks.
const describeCurrentPaymentState = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        return await getCheckoutPaymentOptions(vendorId, websiteMasterData, companyMasterData, companySettingsData)
            .then((result) => {
                if (!result.isSuccess) return `Error ${result.statusCode}: ${result.message}`;
                const online = result.meta.online;
                return [
                    `COD offered: ${result.meta.cod ? 'yes' : 'no'}`,
                    `QR code: ${online?.scannerUrl ? 'yes' : 'no'}`,
                    `Bank details: ${online?.bank ? 'yes' : 'no'}`,
                    `GPay: ${online?.gpayNumber ? 'yes' : 'no'}`
                ].join(', ');
            })
            .catch((checkErr) => `Loading the payment options fails: ${checkErr?.message || checkErr}`);
    } catch (err) {
        throw err;
    }
};

/**
 * A customer reports that checkout can't offer them any way to pay (COD off
 * and the bank details could not be loaded / aren't set up). Emailed to the
 * platform owner (platformAlertService) with the store, the customer and
 * what the server sees now. One report per customer per
 * CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES.
 *
 * @param {Object} report - { reason, errorMessage, cartTotal, itemCount, pageUrl } (validated)
 */
const reportCheckoutPaymentIssue = async (vendorId, userId, vendorData, websiteMasterData, companyMasterData, companySettingsData, report) => {
    try {
        const now = Date.now();
        const cooldownMs = CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES * 60 * 1000;
        forgetOldReports(now, cooldownMs);
        const reportKey = `${vendorId}:${userId}`;
        if (lastCheckoutIssueReportAt.has(reportKey)) {
            return common.returnResult(false, 429, `You have already reported this problem. You can send another report after ${CHECKOUT_ISSUE_REPORT_COOLDOWN_MINUTES} minutes.`);
        }

        const user = await User.findOne({ _id: userId, vendorId })
            .select('name username email phone_no whatsapp_no country state city businessFullName trn')
            .lean();
        const location = await common.resolveLocationNames({ countryId: user?.country, stateId: user?.state, cityId: user?.city });
        const serverState = await describeCurrentPaymentState(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        const storeName = companySettingsData?.companyName || vendorData?.domain || String(vendorId);

        const rows = [
            ['Store', storeName],
            ['Store domain', vendorData?.domain],
            ['Vendor id', String(vendorId)],
            ['Problem', CHECKOUT_ISSUE_REASON_TEXT[report.reason]],
            ["Error the customer's browser got", report.errorMessage],
            ['What the server sees now', serverState],
            ['Customer name', user?.name],
            ['Customer username', user?.username],
            ['Customer email', user?.email],
            ['Customer phone', user?.phone_no],
            ['Customer WhatsApp', user?.whatsapp_no],
            ['Customer location', [location.cityName || user?.city, location.stateName || user?.state, location.countryName || user?.country].filter(Boolean).join(', ')],
            ['Business name / TRN', [user?.businessFullName, user?.trn].filter(Boolean).join(' / ')],
            ['Customer id', String(userId)],
            ['Cart total shown at checkout', report.cartTotal],
            ['Items in cart', report.itemCount != null ? String(report.itemCount) : null],
            ['Page', report.pageUrl],
            ['Reported at', new Date(now).toISOString()]
        ];

        // Kept in the error log too, whether or not the email goes out.
        logger.logWarning('Checkout: customer reported that no payment option is available', {
            additionalData: { vendorId: String(vendorId), userId: String(userId), reason: report.reason, errorMessage: report.errorMessage, serverState }
        });

        const sent = await platformAlertService.sendToPlatformOwner({
            subject: `[${storeName}] Checkout problem: customer can't pay`,
            intro: `A customer of ${storeName} could not place an order: Cash on Delivery is off and no other way to pay could be shown.`,
            rows
        });
        if (!sent.isSuccess) {
            return common.returnResult(false, sent.statusCode, "Sorry, your report could not be sent right now. Please try again later or contact the store directly.");
        }

        lastCheckoutIssueReportAt.set(reportKey, now);
        return common.returnResult(true, 200, 'Thank you - the problem has been reported. Please try again later.');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    initiateOnlinePayment,
    selectCashOnDelivery,
    getCheckoutPaymentOptions,
    checkCustomerCanPay,
    reportCheckoutPaymentIssue,
    selectManualTransfer,
    handleGatewayCallback,
    getPaymentStatus
};
