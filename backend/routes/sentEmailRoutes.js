const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getSendEmailOptions, searchCustomers, sendEmail, getHistory, getHistoryById } = require('../controllers/sentEmailController');
const { sendEmailSchema, historyQuerySchema, customerSearchQuerySchema, idParamSchema } = require('../middlewares/validations/sentEmailValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

// Send Email module - admin only. The feature gates (isSendingEmailFeatureOn
// + isSendEmailModuleOn) are checked in sentEmailService.
const access = [authenticate, authorize('admin'), checkModuleAssigned('SEND_EMAIL')];

// Files for one email: memory storage, checked by fileUploadService /
// imageUploadService against the Send Email limits before any provider sees
// them. This ceiling is only an abuse guard (EMAIL_CONTENT_UPLOAD_MAX_MB).
const hardCeilingMB = Number(process.env.EMAIL_CONTENT_UPLOAD_MAX_MB) || 100;
const sendEmailUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: hardCeilingMB * 1024 * 1024, files: 40 }
}).fields([
    { name: 'attachments', maxCount: 20 },
    { name: 'images', maxCount: 20 }
]);

router.get('/options', ...access, getSendEmailOptions);
router.get('/customers', ...access, validate(customerSearchQuerySchema, 'query'), searchCustomers);
router.post('/send', ...access, sendEmailUpload, validate(sendEmailSchema, 'body'), sendEmail);
router.get('/history', ...access, validate(historyQuerySchema, 'query'), getHistory);
router.get('/history/:id', ...access, validate(idParamSchema, 'params'), getHistoryById);

module.exports = router;
