const express = require('express');
const router = express.Router();

const freeCashController = require('../controllers/freeCashController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');

const {
  createFreeCashSchema,
  updateFreeCashSchema,
  freeCashIdParamSchema,
  revokeFreeCashForUserSchema,
  revokeFreeCashForAllUsersSchema,
  bulkFreeCashStatusSchema,
  bulkDeleteFreeCashSchema
} = require('../middlewares/validations/freeCashValidations');

// ONE excel file, with a "Users" sheet - only needed when giveFreeCashTo
// requires it (SPECIFIC_USERS). Same convention as discount's excel upload.
const freeCashExcelFields = createBulkUploader({ zipFieldNames: [] });

// Admin-only management routes - all vendor-scoped, all gated by
// websiteMaster/companyMaster.isFreeCashFeatureOn (checked in the controller).
router.post(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  freeCashExcelFields,
  validate(createFreeCashSchema, 'body'),
  freeCashController.createFreeCash
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
  checkModuleAssigned('FREE_CASH'),
  validate(bulkFreeCashStatusSchema, 'body'),
  freeCashController.bulkSetFreeCashStatus
);

router.delete(
  '/bulk-delete',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  validate(bulkDeleteFreeCashSchema, 'body'),
  freeCashController.bulkDeleteFreeCash
);

router.put(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  freeCashExcelFields,
  validate(freeCashIdParamSchema, 'params'),
  validate(updateFreeCashSchema, 'body'),
  freeCashController.updateFreeCash
);

router.get(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  validate(freeCashIdParamSchema, 'params'),
  freeCashController.getFreeCashById
);

router.get(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  freeCashController.getAllFreeCashAdmin
);

router.delete(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  validate(freeCashIdParamSchema, 'params'),
  freeCashController.deleteFreeCash
);

router.post(
  '/revoke/user',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  validate(revokeFreeCashForUserSchema, 'body'),
  freeCashController.revokeFreeCashForUser
);

router.post(
  '/revoke/all-users',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('FREE_CASH'),
  validate(revokeFreeCashForAllUsersSchema, 'body'),
  freeCashController.revokeFreeCashForAllUsers
);

module.exports = router;
