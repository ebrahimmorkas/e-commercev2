const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const deliveryAgentController = require('../controllers/deliveryAgentController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const { productsQuerySchema, productIdParamSchema } = require('../middlewares/validations/adminPlaceOrderValidations');
const { agentOrdersQuerySchema } = require('../middlewares/validations/deliveryAgentValidations');
const {
    createOrderSchema,
    orderIdParamSchema,
    advanceOrderStepSchema,
    assignDeliveryAgentSchema,
    changeDeliveryDateSchema,
    setOrderCourierSchema,
    cancelOrderSchema,
    setShippingPriceSchema,
    setShippingAddressSchema,
    addOrderProductsSchema,
    addOrderProductsTaxPreviewSchema
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

router.get(
    '/my-orders/:id/invoice',
    ...vendorContext,
    authorize('user'),
    validate(orderIdParamSchema, 'params'),
    orderController.downloadMyInvoice
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

// The vendor's active delivery agents, for the Assign dropdown on an order.
// Must stay before '/admin/:id'.
router.get('/admin/delivery-agents', ...vendorContext, authorize('admin'), deliveryAgentController.getAssignableDeliveryAgents);

// Every status an order can be in, for the Orders page filter. Must stay before '/admin/:id'.
router.get('/admin/status-options', ...vendorContext, authorize('admin'), orderController.getOrderStatusOptions);

router.get(
    '/admin/:id',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.getOrderByIdAdmin
);

router.get(
    '/admin/:id/invoice',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.downloadInvoiceAdmin
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

// Live tax preview for the products being added (nothing is saved).
router.post(
    '/admin/:id/add-products/tax-preview',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(addOrderProductsTaxPreviewSchema, 'body'),
    orderController.previewAddProductsTax
);

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

// Assigns the order to an agent, or changes its agent (history kept on the order).
router.patch(
    '/admin/:id/assign-delivery-agent',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(assignDeliveryAgentSchema, 'body'),
    orderController.assignDeliveryAgent
);

// Sets, changes or removes (courierId null) the order's courier.
router.patch(
    '/admin/:id/courier',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(setOrderCourierSchema, 'body'),
    orderController.setOrderCourier
);

// Changes only the delivery date of an order that has an agent.
router.patch(
    '/admin/:id/delivery-date',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    validate(changeDeliveryDateSchema, 'body'),
    orderController.changeDeliveryDate
);

router.patch(
    '/admin/:id/unassign-delivery-agent',
    ...vendorContext,
    authorize('admin'),
    validate(orderIdParamSchema, 'params'),
    orderController.unassignDeliveryAgent
);

// --- Delivery agent routes ---
// The logged-in agent's own orders: ?view=pending (to deliver) | done.
router.get(
    '/delivery-agent/my-orders',
    ...vendorContext,
    authorize('deliveryAgent'),
    validate(agentOrdersQuerySchema, 'query'),
    deliveryAgentController.getMyAgentOrders
);

// Makes the vendor's one configured agent step change (CompanySettings
// deliveryAgentFromStep -> deliveryAgentToStep) on an order assigned to them.
router.patch(
    '/delivery-agent/:id/advance-step',
    ...vendorContext,
    authorize('deliveryAgent'),
    validate(orderIdParamSchema, 'params'),
    orderController.deliveryAgentAdvanceStep
);

module.exports = router;
