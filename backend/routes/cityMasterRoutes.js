const express = require('express');
const router = express.Router();
const cityMasterController = require('../controllers/cityMasterController');

router.get('/get-cities', cityMasterController.getCities);

module.exports = router;