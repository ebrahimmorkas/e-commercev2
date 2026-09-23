const express = require('express');
const router = express.Router();

const adminPlaceOrderController = require('../controllers/adminPlaceOrderController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const {
    usersQuerySchema,
    userIdParamSchema,
    productsQuerySchema,
    productIdParamSchema,
    placeOrderSchema,
    taxPreviewSchema,
    orderCurrencyQuerySchema
} = require('../middlewares/validations/adminPlaceOrderValidations');

// Admin only, and only for vendors with the ADMIN_PLACE_ORDER module assigned.
// The isAdminPlacingOrderOnBehalfOfUserIsOn feature switch is checked in the service.
const adminContext = [authenticate, vendorDetection, ensureVendorDataCached, checkModuleAssigned('ADMIN_PLACE_ORDER'), authorize('admin')];

// --- Dropdown data ---
router.get('/user-search-fields', ...adminContext, adminPlaceOrderController.getUserSearchFields);
router.get('/users', ...adminContext, validate(usersQuerySchema, 'query'), adminPlaceOrderController.getUsersBySearchField);
router.get('/users/:userId/addresses', ...adminContext, validate(userIdParamSchema, 'params'), adminPlaceOrderController.getUserAddresses);
router.get('/categories', ...adminContext, adminPlaceOrderController.getCategories);
router.get('/products', ...adminContext, validate(productsQuerySchema, 'query'), adminPlaceOrderController.getProducts);
router.get('/products/:productId/options', ...adminContext, validate(productIdParamSchema, 'params'), adminPlaceOrderController.getProductOptions);

// --- Currency the page shows / the admin types amounts in (customer's, or walk-in store currency) ---
router.get('/currency', ...adminContext, validate(orderCurrencyQuerySchema, 'query'), adminPlaceOrderController.getOrderCurrency);

// --- Live tax preview (nothing is saved) ---
router.post('/tax-preview', ...adminContext, validate(taxPreviewSchema, 'body'), adminPlaceOrderController.previewTax);

// --- Place the order ---
router.post('/place-order', ...adminContext, validate(placeOrderSchema, 'body'), adminPlaceOrderController.placeOrder);

module.exports = router;
