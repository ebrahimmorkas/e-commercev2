const express = require('express');
const router = express.Router();
const { addTemplate, updateTemplate, deleteTemplate, getAllTemplatesAdmin, getTemplateById, getAvailableVariables, bulkSetTemplateStatus, bulkDeleteTemplates, changeTemplateModule, unassignTemplateModule, bulkUnassignTemplateModules } = require('../controllers/emailTemplateMasterController');
const { addTemplateSchema, updateTemplateSchema, deleteTemplateSchema, bulkTemplateStatusSchema, bulkDeleteTemplateSchema, changeTemplateModuleSchema, unassignTemplateModuleSchema, bulkUnassignTemplateModuleSchema, idParamSchema, moduleParamSchema } = require('../middlewares/validations/emailTemplateMasterValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

router.post('/add-template', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(addTemplateSchema, 'body'), addTemplate);
router.put('/update-template', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(updateTemplateSchema, 'body'), updateTemplate);
router.delete('/delete-template', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(deleteTemplateSchema, 'body'), deleteTemplate);
router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(bulkTemplateStatusSchema, 'body'), bulkSetTemplateStatus);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(bulkDeleteTemplateSchema, 'body'), bulkDeleteTemplates);
router.patch('/change-module', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(changeTemplateModuleSchema, 'body'), changeTemplateModule);
router.patch('/unassign-module', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(unassignTemplateModuleSchema, 'body'), unassignTemplateModule);
router.patch('/bulk-unassign-module', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(bulkUnassignTemplateModuleSchema, 'body'), bulkUnassignTemplateModules);
router.get('/get-all-templates', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), getAllTemplatesAdmin);
router.get('/get-template/:id', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(idParamSchema, 'params'), getTemplateById);
router.get('/variables/:module', authenticate, authorize('admin'), checkModuleAssigned('EMAIL_TEMPLATE'), validate(moduleParamSchema, 'params'), getAvailableVariables);

module.exports = router;
