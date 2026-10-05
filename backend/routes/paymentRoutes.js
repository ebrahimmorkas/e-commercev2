const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const { orderIdParamSchema, gatewayCallbackParamSchema } = require('../middlewares/validations/paymentValidations');

const vendorContext = [authenticate, vendorDetection, ensureVendorDataCached];

// --- Customer routes ---
router.post(
    '/:orderId/initiate',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    paymentController.initiateOnlinePayment
);

router.post(
    '/:orderId/cod',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    paymentController.selectCashOnDelivery
);

// What checkout can offer (COD, QR / bank details, admin WhatsApp) - customers only.
router.get('/options', ...vendorContext, authorize('user'), paymentController.getCheckoutPaymentOptions);

router.post(
    '/:orderId/manual-transfer',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    paymentController.selectManualTransfer
);

router.get(
    '/:orderId/status',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    paymentController.getPaymentStatus
);

// --- Gateway webhook (server-to-server, no authenticate/authorize - the
// gateway itself is the caller, not a logged-in user) ---
router.post(
    '/callback/:gateway',
    vendorDetection,
    validate(gatewayCallbackParamSchema, 'params'),
    paymentController.handleGatewayCallback
);

module.exports = router;
