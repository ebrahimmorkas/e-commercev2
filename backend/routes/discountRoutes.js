const express = require('express');
const router = express.Router();

const discountController = require('../controllers/discountController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
const validate = require('../middlewares/validate');
const { bulkDiscountStatusSchema, bulkDeleteDiscountSchema } = require('../middlewares/validations/discountValidations');

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
  checkModuleAssigned('DISCOUNT'),
  discountExcelFields,
  discountController.createDiscount
);

// Bulk multi-select actions (frontend checkbox selection) - registered
// before the "/:id" routes below so "/bulk-status"/"/bulk-delete" are never
// swallowed by the ":id" param match.
router.patch(
  '/bulk-status',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  validate(bulkDiscountStatusSchema, 'body'),
  discountController.bulkSetDiscountStatus
);

router.delete(
  '/bulk-delete',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  validate(bulkDeleteDiscountSchema, 'body'),
  discountController.bulkDeleteDiscounts
);

router.put(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  discountExcelFields,
  discountController.updateDiscount
);

router.get(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  discountController.getDiscountById
);

router.get(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  discountController.getAllDiscountsAdmin
);

router.delete(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  discountController.deleteDiscount
);

// Public storefront route - no authenticate/authorize, only vendor context is needed.
router.get(
  '/storefront/active',
  vendorDetection,
  ensureVendorDataCached,
  checkModuleAssigned('DISCOUNT'),
  discountController.getActiveDiscounts
);

module.exports = router;