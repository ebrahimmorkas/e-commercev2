const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

router.get('/get-all-users-admin', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), userController.getAllUsersAdmin);

module.exports = router;
