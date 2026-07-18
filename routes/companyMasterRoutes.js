const express = require('express');
const { getCompanyMasterData } = require('../controllers/companyMasterController');
const router = express.Router();

router.get('/get-company-master-data', getCompanyMasterData);

module.exports = router;