const express = require('express');
const router = express.Router();
const weightMasterController = require('../controllers/weightMasterController');

// No auth, no validation, no vendor scoping — global master data (mirrors unitMasterRoutes.js)
router.get('/get-weights', weightMasterController.getWeights);

module.exports = router;
