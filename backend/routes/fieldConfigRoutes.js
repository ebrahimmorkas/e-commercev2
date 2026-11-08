const express = require('express');
const router = express.Router();
const fieldConfigController = require('../controllers/fieldConfigController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');

// Read-only: the config itself is written by scripts/manageVendorFieldConfig.js.
// Not module-gated - every admin module that has configurable fields reads it.
router.get('/get-field-config-admin', authenticate, authorize('admin'), vendorDetection, fieldConfigController.getFieldConfigAdmin);

module.exports = router;
