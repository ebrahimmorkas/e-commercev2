const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const { bulkUserStatusSchema, bulkDeleteUserSchema } = require('../middlewares/validations/userValidations');

router.get('/get-all-users-admin', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), userController.getAllUsersAdmin);

router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(bulkUserStatusSchema, 'body'), userController.bulkSetUserStatus);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(bulkDeleteUserSchema, 'body'), userController.bulkDeleteUsers);

module.exports = router;
