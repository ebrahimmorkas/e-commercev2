const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const { userIdParamSchema, createUserAdminSchema, updateUserAdminSchema, changePasswordAdminSchema, bulkUserStatusSchema, bulkDeleteUserSchema } = require('../middlewares/validations/userValidations');

// Gated by its own ADD_USER module - a separate vendor assignment from
// CUSTOMERS (see backend/seeds/seedModuleMaster.js) - on top of the
// isAdminAddingUserFeatureAllowed flag the service checks.
router.post('/create-user-admin', authenticate, authorize('admin'), checkModuleAssigned('ADD_USER'), validate(createUserAdminSchema, 'body'), userController.createUserByAdmin);

router.get('/get-all-users-admin', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), userController.getAllUsersAdmin);
router.get('/get-user-admin/:id', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(userIdParamSchema, 'params'), userController.getUserByIdAdmin);

router.patch('/update-user-admin/:id', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(userIdParamSchema, 'params'), validate(updateUserAdminSchema, 'body'), userController.updateUserByAdmin);
router.patch('/change-password-admin/:id', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(userIdParamSchema, 'params'), validate(changePasswordAdminSchema, 'body'), userController.changePasswordByAdmin);
router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(bulkUserStatusSchema, 'body'), userController.bulkSetUserStatus);

router.delete('/delete-user-admin/:id', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(userIdParamSchema, 'params'), userController.deleteUserByAdmin);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('CUSTOMERS'), validate(bulkDeleteUserSchema, 'body'), userController.bulkDeleteUsers);

module.exports = router;
