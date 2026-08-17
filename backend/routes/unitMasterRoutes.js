const express = require('express');
const router = express.Router();
const unitMasterController = require('../controllers/unitMasterController');

// No auth, no validation, no vendor scoping — global master data
router.get('/get-units', unitMasterController.getUnits);

module.exports = router;