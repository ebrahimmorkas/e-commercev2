const express = require('express');
const router = express.Router();
const sizeMasterController = require('../controllers/sizeMasterController');

// No auth/validation needed — vendor is resolved by vendorDetection,
// allowedSizes comes from ensureVendorDataCached (req.companyMasterData)
router.get('/get-sizes', sizeMasterController.getSizes);

module.exports = router;