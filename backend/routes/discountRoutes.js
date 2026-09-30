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
const {
  createDiscountSchema,
  updateDiscountSchema,
  excelSampleQuerySchema,
  bulkDiscountStatusSchema,
  bulkDeleteDiscountSchema
} = require('../middlewares/validations/discountValidations');

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
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  discountExcelFields,
  validate(createDiscountSchema, 'body'),
  discountController.createDiscount
);

// Sample excel for the chosen giveDiscountTo - registered before the "/:id"
// routes below so "/excel-sample" is never taken for an id.
router.get(
  '/excel-sample',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('DISCOUNT'),
  validate(excelSampleQuerySchema, 'query'),
  discountController.downloadTargetingSampleFile
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
  validate(updateDiscountSchema, 'body'),
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

// Storefront route - logged-in customers only (discounts are never shown to guests).
router.get(
  '/storefront/active',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  checkModuleAssigned('DISCOUNT'),
  discountController.getActiveDiscounts
);

module.exports = router;