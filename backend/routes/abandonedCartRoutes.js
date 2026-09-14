const express = require('express');
const router = express.Router();

const abandonedCartController = require('../controllers/abandonedCartController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

// Admin-only - vendor-scoped, gated by websiteMaster/companyMaster.isAbondonedCartFeatureOn
// (checked in the controller) and by the ABANDONED_CART module assignment.
router.get(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('ABANDONED_CART'),
  abandonedCartController.getAllAbandonedCartsAdmin
);

module.exports = router;
