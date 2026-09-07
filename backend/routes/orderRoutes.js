const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const {
    createOrderSchema,
    orderIdParamSchema,
    advanceOrderStepSchema,
    assignDeliveryAgentSchema,
    cancelOrderSchema
} = require('../middlewares/validations/orderValidations');

const vendorContext = [authenticate, vendorDetection, ensureVendorDataCached];

// --- Customer routes ---
router.post(
    '/place-order',
    ...vendorContext,
    authorize('user'),
    validate(createOrderSchema, 'body'),
    orderController.createOrder
);

router.get('/my-orders', ...vendorContext, authorize('user'), orderController.getMyOrders);

router.get(
    '/my-orders/:id',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    orderController.getMyOrderById
);

router.post(
    '/my-orders/:id/cancel',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    validate(cancelOrderSchema, 'body'),
    orderController.cancelOrder
);

// --- Admin routes ---
router.get('/admin', ...vendorContext, authorize('admin'), orderController.getAllOrdersAdmin);

router.get(
    '/admin/:id',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.getOrderByIdAdmin
);

router.patch(
    '/admin/:id/advance-step',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(advanceOrderStepSchema, 'body'),
    orderController.advanceOrderStep
);

router.patch(
    '/admin/:id/assign-delivery-agent',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(assignDeliveryAgentSchema, 'body'),
    orderController.assignDeliveryAgent
);

// --- Delivery agent route ---
router.patch(
    '/delivery-agent/:id/mark-delivered',
    ...vendorContext,
    authorize('deliveryAgent'),
    validate(orderIdParamSchema, 'params'),
    orderController.deliveryAgentMarkDelivered
);

module.exports = router;
