const express = require('express');
const router = express.Router();

const abandonedCartController = require('../controllers/abandonedCartController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const { abandonedCartIdParamSchema } = require('../middlewares/validations/abandonedCartValidations');

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

// Places the order for one customer's abandoned cart straight from the list.
// On top of the Abandoned Cart gates it needs everything Place Order needs:
// the ADMIN_PLACE_ORDER module, and isAdminPlacingOrderOnBehalfOfUserIsOn
// (checked in adminPlaceOrderService).
router.post(
  '/:id/place-order',
  authenticate,
  vendorDetection,
  ensureVendorDataCached,
  authorize('admin'),
  checkModuleAssigned('ABANDONED_CART'),
  checkModuleAssigned('ADMIN_PLACE_ORDER'),
  validate(abandonedCartIdParamSchema, 'params'),
  abandonedCartController.placeOrderFromAbandonedCart
);

module.exports = router;
