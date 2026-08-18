const express = require('express');
const router = express.Router();
const taxMasterController = require('../controllers/taxMasterController');

router.get('/get-taxes', taxMasterController.getTaxes);

module.exports = router;