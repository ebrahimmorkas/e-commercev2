const express = require('express');
const { createShippingPriceSettings, updateShippingPriceSettings, getShippingPriceSettings } = require('../controllers/shippingPriceSettingsController');
const { createShippingPriceSettingsSchema, updateShippingPriceSettingsSchema } = require('../middlewares/validations/shippingPriceSettingsValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const router = express.Router();

router.get('/get-shipping-price-settings', getShippingPriceSettings);
router.post('/create-shipping-price-settings', authenticate, authorize('admin'), validate(createShippingPriceSettingsSchema, 'body'), createShippingPriceSettings);
router.put('/update-shipping-price-settings', authenticate, authorize('admin'), validate(updateShippingPriceSettingsSchema, 'body'), updateShippingPriceSettings);

module.exports = router;
