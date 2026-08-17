const express = require('express');
const router = express.Router();
const countryMasterController = require('../controllers/countryMasterController');

// No auth/validation needed — vendor is resolved by vendorDetection,
// allowedCountries comes from ensureVendorDataCached (req.companyMasterData)
router.get('/get-countries', countryMasterController.getCountries);

module.exports = router;