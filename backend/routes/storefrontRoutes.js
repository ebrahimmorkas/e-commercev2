const express = require('express');
const router = express.Router();
const controller = require('../controllers/storefrontController');
const { saveDraftSchema } = require('../middlewares/validations/storefrontValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');

const admin = [authenticate, authorize('admin'), checkModuleAssigned('STOREFRONT')];

// Public: the published look of this vendor's storefront (vendor comes from the hostname).
router.get('/config', controller.getStorefrontConfig);

// Admin (Storefront Customization page).
router.get('/admin', ...admin, controller.getAdminSettings);
router.put('/draft', ...admin, validate(saveDraftSchema, 'body'), controller.saveDraft);
router.post('/publish', ...admin, controller.publish);
router.post('/discard', ...admin, controller.discardDraft);

module.exports = router;
