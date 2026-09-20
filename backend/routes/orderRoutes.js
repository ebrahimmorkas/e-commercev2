const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const { productsQuerySchema, productIdParamSchema } = require('../middlewares/validations/adminPlaceOrderValidations');
const {
    createOrderSchema,
    orderIdParamSchema,
    advanceOrderStepSchema,
    assignDeliveryAgentSchema,
    cancelOrderSchema,
    setShippingPriceSchema,
    setShippingAddressSchema,
    addOrderProductsSchema
} = require('../middlewares/validations/orderValidations');

const vendorContext = [authenticate, vendorDetection, ensureVendorDataCached, checkModuleAssigned('ORDERS')];

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

router.get(
    '/admin/:id/steps',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.getOrderStepOptions
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
    '/admin/:id/shipping-price',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(setShippingPriceSchema, 'body'),
    orderController.setOrderShippingPrice
);

router.put(
    '/admin/:id/shipping-price',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(setShippingPriceSchema, 'body'),
    orderController.updateOrderShippingPrice
);

// --- Edit Order (gated by isEditingOrderFeatureOn in the controller) ---
// Product picker data - the same picker Place Order uses.
router.get('/admin/edit/categories', ...vendorContext, authorize('admin'), orderController.getEditOrderCategories);
router.get('/admin/edit/products', ...vendorContext, authorize('admin'), validate(productsQuerySchema, 'query'), orderController.getEditOrderProducts);
router.get('/admin/edit/products/:productId/options', ...vendorContext, authorize('admin'), validate(productIdParamSchema, 'params'), orderController.getEditOrderProductOptions);

router.post(
    '/admin/:id/add-products',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(addOrderProductsSchema, 'body'),
    orderController.addProductsToOrder
);

router.get(
    '/admin/:id/user-addresses',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.getOrderUserAddresses
);

router.put(
    '/admin/:id/shipping-address',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(setShippingAddressSchema, 'body'),
    orderController.updateOrderShippingAddress
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
