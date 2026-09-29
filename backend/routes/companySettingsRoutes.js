const express = require('express');
const { createCompanySettings, updateCompanySettings, getCompanySettings, getCompanySettingsAdmin, getAssignedOrderSteps, assignEmailTemplate, unassignEmailTemplate, addEmailAttachment, removeEmailAttachment, addEmailImage, removeEmailImage } = require('../controllers/companySettingsController');
const { createCompanySettingsSchema, updateCompanySettingsSchema, assignEmailTemplateSchema, unassignEmailTemplateSchema, addEmailAttachmentSchema, addEmailImageSchema, emailContentIdParamSchema } = require('../middlewares/validations/companySettingsValidations');
const emailContentUpload = require('../middlewares/emailContentUpload');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const companySettingsUpload = require('../middlewares/imageUpload');
const router = express.Router();

const companySettingsFileFields = companySettingsUpload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'paymentScanner', maxCount: 1 },
    { name: 'partnerCertificate', maxCount: 1 }
]);

// Public/storefront read - filtered to fields safe for an anonymous visitor
// (see formatPublicCompanySettings). The full document, including bank
// details and admin contact info, is only ever served from the -admin route
// below, which requires authentication.
router.get('/get-company-settings', checkModuleAssigned('COMPANY_SETTINGS'), getCompanySettings);
router.get('/get-company-settings-admin', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), getCompanySettingsAdmin);
router.get('/order-steps', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), getAssignedOrderSteps);
router.post('/create-company-settings', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), companySettingsFileFields, validate(createCompanySettingsSchema, 'body'), createCompanySettings);
router.put('/update-company-settings', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), companySettingsFileFields, validate(updateCompanySettingsSchema, 'body'), updateCompanySettings);
router.post('/assign-email-template', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), validate(assignEmailTemplateSchema, 'body'), assignEmailTemplate);
router.delete('/unassign-email-template', authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS'), validate(unassignEmailTemplateSchema, 'body'), unassignEmailTemplate);

// Email tab: files and images kept ready for emails. Saved immediately (not
// through create/update), one file per request, in the "file" field.
const emailContentAccess = [authenticate, authorize('admin'), checkModuleAssigned('COMPANY_SETTINGS')];
router.post('/email-attachments', ...emailContentAccess, emailContentUpload.single('file'), validate(addEmailAttachmentSchema, 'body'), addEmailAttachment);
router.delete('/email-attachments/:id', ...emailContentAccess, validate(emailContentIdParamSchema, 'params'), removeEmailAttachment);
router.post('/email-images', ...emailContentAccess, emailContentUpload.single('file'), validate(addEmailImageSchema, 'body'), addEmailImage);
router.delete('/email-images/:id', ...emailContentAccess, validate(emailContentIdParamSchema, 'params'), removeEmailImage);

module.exports = router;
