const express = require('express');
const router = express.Router();

const discountController = require('../controllers/discountController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const excelUpload = require('../middlewares/excelUpload');

// ASSUMPTION (app.js not available to verify): vendorDetection must run before
// ensureVendorDataCached (it needs req.vendorId), and authenticate must run
// before authorize (it needs req.user). If your app.js already applies
// vendorDetection/ensureVendorDataCached globally to all routes, these can be
// removed here to avoid running them twice.

// Accepts up to one excel file per target type in a single multipart request.
// Only the field(s) relevant to the chosen giveDiscountTo need to be sent.
const discountExcelFields = excelUpload.fields([
  { name: 'productsFile', maxCount: 1 },
  { name: 'categoriesFile', maxCount: 1 },
  { name: 'usersFile', maxCount: 1 }
]);

// Admin-only management routes
router.post(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  discountExcelFields,
  discountController.createDiscount
);

router.put(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  discountExcelFields,
  discountController.updateDiscount
);

router.get(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  discountController.getDiscountById
);

router.get(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  discountController.getAllDiscountsAdmin
);

router.delete(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  discountController.deleteDiscount
);

// Public storefront route - no authenticate/authorize, only vendor context is needed.
router.get(
  '/storefront/active',
  vendorDetection,
  ensureVendorDataCached,
  discountController.getActiveDiscounts
);

module.exports = router;