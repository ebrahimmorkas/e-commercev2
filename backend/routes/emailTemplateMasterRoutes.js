const express = require('express');
const router = express.Router();
const { addTemplate, updateTemplate, deleteTemplate, getAllTemplatesAdmin, getTemplateById, getAvailableVariables } = require('../controllers/emailTemplateMasterController');
const { addTemplateSchema, updateTemplateSchema, deleteTemplateSchema, idParamSchema, moduleParamSchema } = require('../middlewares/validations/emailTemplateMasterValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.post('/add-template', authenticate, authorize('admin'), validate(addTemplateSchema, 'body'), addTemplate);
router.put('/update-template', authenticate, authorize('admin'), validate(updateTemplateSchema, 'body'), updateTemplate);
router.delete('/delete-template', authenticate, authorize('admin'), validate(deleteTemplateSchema, 'body'), deleteTemplate);
router.get('/get-all-templates', authenticate, authorize('admin'), getAllTemplatesAdmin);
router.get('/get-template/:id', authenticate, authorize('admin'), validate(idParamSchema, 'params'), getTemplateById);
router.get('/variables/:module', authenticate, authorize('admin'), validate(moduleParamSchema, 'params'), getAvailableVariables);

module.exports = router;
