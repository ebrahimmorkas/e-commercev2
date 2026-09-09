const express = require('express');
const { createCompanySettings, updateCompanySettings, getCompanySettings, assignEmailTemplate, unassignEmailTemplate } = require('../controllers/companySettingsController');
const { createCompanySettingsSchema, updateCompanySettingsSchema, assignEmailTemplateSchema, unassignEmailTemplateSchema } = require('../middlewares/validations/companySettingsValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const companySettingsUpload = require('../middlewares/imageUpload');
const router = express.Router();

const companySettingsFileFields = companySettingsUpload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'paymentScanner', maxCount: 1 }
]);

router.get('/get-company-settings', getCompanySettings);
router.post('/create-company-settings', authenticate, authorize('admin'), companySettingsFileFields, validate(createCompanySettingsSchema, 'body'), createCompanySettings);
router.put('/update-company-settings', authenticate, authorize('admin'), companySettingsFileFields, validate(updateCompanySettingsSchema, 'body'), updateCompanySettings);
router.post('/assign-email-template', authenticate, authorize('admin'), validate(assignEmailTemplateSchema, 'body'), assignEmailTemplate);
router.delete('/unassign-email-template', authenticate, authorize('admin'), validate(unassignEmailTemplateSchema, 'body'), unassignEmailTemplate);

module.exports = router;
