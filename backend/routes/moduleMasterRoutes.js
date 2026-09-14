const express = require('express');
const router = express.Router();
const { getAllModulesAdmin } = require('../controllers/moduleMasterController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.get('/get-all-modules', authenticate, authorize('admin'), getAllModulesAdmin);

module.exports = router;
