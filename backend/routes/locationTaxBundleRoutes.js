const express = require('express');
const router = express.Router();
const locationTaxBundleController = require('../controllers/locationTaxBundleController');

router.get('/get-location-tax-bundle', locationTaxBundleController.getLocationTaxBundle);

module.exports = router;