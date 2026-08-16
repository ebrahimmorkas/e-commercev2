const express = require('express');
const router = express.Router();

const groupController = require('../controllers/groupController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createGroupSchema, updateGroupSchema, groupIdBodySchema, groupIdParamSchema, listGroupsQuerySchema } = require('../middlewares/validations/groupValidations');

router.post('/', authenticate, authorize('admin'), validate(createGroupSchema, 'body'), groupController.createGroup);
router.get('/', authenticate, authorize('admin'), validate(listGroupsQuerySchema, 'query'), groupController.getAllGroups);
router.get('/:id', authenticate, authorize('admin'), validate(groupIdParamSchema, 'params'), groupController.getGroupById);
router.put('/', authenticate, authorize('admin'), validate(updateGroupSchema, 'body'), groupController.updateGroup);
router.delete('/', authenticate, authorize('admin'), validate(groupIdBodySchema, 'body'), groupController.softDeleteGroup);
router.patch('/activate', authenticate, authorize('admin'), validate(groupIdBodySchema, 'body'), groupController.activateGroup);
router.patch('/deactivate', authenticate, authorize('admin'), validate(groupIdBodySchema, 'body'), groupController.deactivateGroup);

module.exports = router;