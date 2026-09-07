const express = require('express');
const router = express.Router();

const orderExchangeController = require('../controllers/orderExchangeController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const {
    orderIdParamSchema,
    exchangeIdParamSchema,
    createExchangeRequestSchema,
    approveExchangeSchema,
    rejectExchangeSchema
} = require('../middlewares/validations/orderExchangeValidations');

const vendorContext = [authenticate, vendorDetection, ensureVendorDataCached];

// --- Customer routes ---
router.post(
    '/order/:orderId',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    validate(createExchangeRequestSchema, 'body'),
    orderExchangeController.createExchangeRequest
);

router.get('/my-exchanges', ...vendorContext, authorize('user'), orderExchangeController.getMyExchanges);

// --- Admin routes ---
router.get('/admin', ...vendorContext, authorize('admin'), orderExchangeController.getAllExchangesAdmin);

router.patch(
    '/admin/:id/approve',
    ...vendorContext,
    authorize('admin'),
    validate(exchangeIdParamSchema, 'params'),
    validate(approveExchangeSchema, 'body'),
    orderExchangeController.approveExchange
);

router.patch(
    '/admin/:id/reject',
    ...vendorContext,
    authorize('admin'),
    validate(exchangeIdParamSchema, 'params'),
    validate(rejectExchangeSchema, 'body'),
    orderExchangeController.rejectExchange
);

router.patch(
    '/admin/:id/picked-up',
    ...vendorContext,
    authorize('admin'),
    validate(exchangeIdParamSchema, 'params'),
    orderExchangeController.markExchangePickedUp
);

router.patch(
    '/admin/:id/replacement-shipped',
    ...vendorContext,
    authorize('admin'),
    validate(exchangeIdParamSchema, 'params'),
    orderExchangeController.markExchangeReplacementShipped
);

router.patch(
    '/admin/:id/completed',
    ...vendorContext,
    authorize('admin'),
    validate(exchangeIdParamSchema, 'params'),
    orderExchangeController.markExchangeCompleted
);

module.exports = router;
