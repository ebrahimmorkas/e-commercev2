const express = require('express');
const { createShippingPriceSettings, updateShippingPriceSettings, getShippingPriceSettings, getShippingPriceCurrencies } = require('../controllers/shippingPriceSettingsController');
const { createShippingPriceSettingsSchema, updateShippingPriceSettingsSchema } = require('../middlewares/validations/shippingPriceSettingsValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const router = express.Router();

router.get('/get-shipping-price-settings', getShippingPriceSettings);
router.get('/get-shipping-price-currencies', authenticate, authorize('admin'), getShippingPriceCurrencies);
router.post('/create-shipping-price-settings', authenticate, authorize('admin'), validate(createShippingPriceSettingsSchema, 'body'), createShippingPriceSettings);
router.put('/update-shipping-price-settings', authenticate, authorize('admin'), validate(updateShippingPriceSettingsSchema, 'body'), updateShippingPriceSettings);

module.exports = router;
