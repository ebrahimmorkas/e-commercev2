const express = require('express');
const router = express.Router();
const { getCustomersFreeCash, getCustomerFreeCashHistory } = require('../controllers/freeCashUsageController');
const { customersQuerySchema, customerIdParamSchema } = require('../middlewares/validations/freeCashUsageValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

// Admin only, read-only, and only for a vendor the FREE_CASH_USAGE module is
// assigned to (the controller also checks isFreeCashFeatureOn).
// vendorDetection + ensureVendorDataCached already ran app-wide (server.js).
const adminAccess = [authenticate, authorize('admin'), checkModuleAssigned('FREE_CASH_USAGE')];

router.get('/get-customers', ...adminAccess, validate(customersQuerySchema, 'query'), getCustomersFreeCash);
router.get('/get-customer-history/:userId', ...adminAccess, validate(customerIdParamSchema, 'params'), getCustomerFreeCashHistory);

module.exports = router;
