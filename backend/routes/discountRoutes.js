const express = require('express');
const router = express.Router();

const discountController = require('../controllers/discountController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');

// ONE excel file, with sheets named "Products" / "Categories" / "Users" -
// only the sheet(s) relevant to the chosen giveDiscountTo need data.
// Same multer factory + same "one excelFile" convention as category/product bulk upload.
const discountExcelFields = createBulkUploader({
  excelFieldNames: ['excelFile'],
  zipFieldNames: []
});

// Admin-only management routes
router.post(
  '/add-discount',
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