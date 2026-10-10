const express = require('express');
const router = express.Router();
const { getInventory, adjustStock, bulkAdjustStock, getInventoryLogs } = require('../controllers/inventoryController');
const { inventoryListQuerySchema, adjustStockSchema, bulkAdjustStockSchema, inventoryLogQuerySchema } = require('../middlewares/validations/inventoryValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

// Admin only, and only for a vendor the INVENTORY module is assigned to.
// vendorDetection + ensureVendorDataCached already ran app-wide (server.js).
const adminAccess = [authenticate, authorize('admin'), checkModuleAssigned('INVENTORY')];

router.get('/get-inventory', ...adminAccess, validate(inventoryListQuerySchema, 'query'), getInventory);
router.get('/get-inventory-logs', ...adminAccess, validate(inventoryLogQuerySchema, 'query'), getInventoryLogs);

router.patch('/adjust-stock', ...adminAccess, validate(adjustStockSchema, 'body'), adjustStock);
router.patch('/bulk-adjust-stock', ...adminAccess, validate(bulkAdjustStockSchema, 'body'), bulkAdjustStock);

module.exports = router;
