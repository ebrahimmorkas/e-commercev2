const express = require('express');
const router = express.Router();
const currencyController = require('../controllers/currencyController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Storefront (guests too): which currency to show prices in, and the rate.
router.get('/context', authenticate.optional, currencyController.getCurrencyContext);

// Admin screens: the store currency, and the list for Company Settings.
router.get('/store', authenticate, authorize('admin'), currencyController.getStoreCurrency);
router.get('/currencies', authenticate, authorize('admin'), currencyController.getCurrencies);

module.exports = router;
