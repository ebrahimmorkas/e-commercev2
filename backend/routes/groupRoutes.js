const express = require('express');
const router = express.Router();

const groupController = require('../controllers/groupController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
const { createGroupSchema, updateGroupSchema, groupIdBodySchema, groupIdParamSchema, listGroupsQuerySchema } = require('../middlewares/validations/groupValidations');

// ONE excel file, sheet named "Products"/"Categories"/"Users" depending on the
// group's groupType - only present when the vendor chose the excel-upload
// members mode instead of the manual picker. Same multer factory + "one
// excelFile, no zips" convention as discount/freeCash.
const groupExcelFields = createBulkUploader({ zipFieldNames: [] });

router.post('/', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), groupExcelFields, validate(createGroupSchema, 'body'), groupController.createGroup);
router.get('/', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), validate(listGroupsQuerySchema, 'query'), groupController.getAllGroups);
router.get('/:id', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), validate(groupIdParamSchema, 'params'), groupController.getGroupById);
router.put('/', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), groupExcelFields, validate(updateGroupSchema, 'body'), groupController.updateGroup);
router.delete('/', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), validate(groupIdBodySchema, 'body'), groupController.softDeleteGroup);
router.patch('/activate', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), validate(groupIdBodySchema, 'body'), groupController.activateGroup);
router.patch('/deactivate', authenticate, authorize('admin'), checkModuleAssigned('GROUP'), validate(groupIdBodySchema, 'body'), groupController.deactivateGroup);

module.exports = router;