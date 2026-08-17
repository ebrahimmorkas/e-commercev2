const express = require('express');
const router = express.Router();
const stateMasterController = require('../controllers/stateMasterController');

router.get('/get-states', stateMasterController.getStates);

module.exports = router;