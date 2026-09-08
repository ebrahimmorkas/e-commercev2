const express = require('express');
const { getCompanySettings, assignEmailTemplate, unassignEmailTemplate } = require('../controllers/companySettingsController');
const { assignEmailTemplateSchema, unassignEmailTemplateSchema } = require('../middlewares/validations/companySettingsValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const router = express.Router();

router.get('/get-company-settings', getCompanySettings);
router.post('/assign-email-template', authenticate, authorize('admin'), validate(assignEmailTemplateSchema, 'body'), assignEmailTemplate);
router.delete('/unassign-email-template', authenticate, authorize('admin'), validate(unassignEmailTemplateSchema, 'body'), unassignEmailTemplate);

module.exports = router;
