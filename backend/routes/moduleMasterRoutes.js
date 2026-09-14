const express = require('express');
const router = express.Router();
const { getAllModulesAdmin, getMyAssignedModules } = require('../controllers/moduleMasterController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.get('/get-all-modules', authenticate, authorize('admin'), getAllModulesAdmin);
router.get('/get-my-assigned-modules', authenticate, authorize('admin'), getMyAssignedModules);

module.exports = router;
