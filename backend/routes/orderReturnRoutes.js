const express = require('express');
const router = express.Router();

const orderReturnController = require('../controllers/orderReturnController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const {
    orderIdParamSchema,
    returnIdParamSchema,
    createReturnRequestSchema,
    approveReturnSchema,
    rejectReturnSchema
} = require('../middlewares/validations/orderReturnValidations');

const vendorContext = [authenticate, vendorDetection, ensureVendorDataCached];

// --- Customer routes ---
router.post(
    '/order/:orderId',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    validate(createReturnRequestSchema, 'body'),
    orderReturnController.createReturnRequest
);

router.get('/my-returns', ...vendorContext, authorize('user'), orderReturnController.getMyReturns);

// --- Admin routes ---
router.get('/admin', ...vendorContext, authorize('admin'), orderReturnController.getAllReturnsAdmin);

router.patch(
    '/admin/:id/approve',
    ...vendorContext,
    authorize('admin'),
    validate(returnIdParamSchema, 'params'),
    validate(approveReturnSchema, 'body'),
    orderReturnController.approveReturn
);

router.patch(
    '/admin/:id/reject',
    ...vendorContext,
    authorize('admin'),
    validate(returnIdParamSchema, 'params'),
    validate(rejectReturnSchema, 'body'),
    orderReturnController.rejectReturn
);

router.patch(
    '/admin/:id/picked-up',
    ...vendorContext,
    authorize('admin'),
    validate(returnIdParamSchema, 'params'),
    orderReturnController.markReturnPickedUp
);

router.patch(
    '/admin/:id/refunded',
    ...vendorContext,
    authorize('admin'),
    validate(returnIdParamSchema, 'params'),
    orderReturnController.markReturnRefunded
);

module.exports = router;
