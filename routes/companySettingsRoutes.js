const express = require('express');
const { getCompanySettings } = require('../controllers/companySettingsController');
const router = express.Router();

router.get('/get-company-settings', getCompanySettings);

module.exports = router;