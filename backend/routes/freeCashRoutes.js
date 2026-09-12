const express = require('express');
const router = express.Router();

const freeCashController = require('../controllers/freeCashController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');

const {
  createFreeCashSchema,
  updateFreeCashSchema,
  freeCashIdParamSchema,
  revokeFreeCashForUserSchema,
  revokeFreeCashForAllUsersSchema
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
  freeCashExcelFields,
  validate(createFreeCashSchema, 'body'),
  freeCashController.createFreeCash
);

router.put(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
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
  validate(freeCashIdParamSchema, 'params'),
  freeCashController.getFreeCashById
);

router.get(
  '/',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  freeCashController.getAllFreeCashAdmin
);

router.delete(
  '/:id',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  validate(freeCashIdParamSchema, 'params'),
  freeCashController.deleteFreeCash
);

router.post(
  '/revoke/user',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  validate(revokeFreeCashForUserSchema, 'body'),
  freeCashController.revokeFreeCashForUser
);

router.post(
  '/revoke/all-users',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  validate(revokeFreeCashForAllUsersSchema, 'body'),
  freeCashController.revokeFreeCashForAllUsers
);

module.exports = router;
