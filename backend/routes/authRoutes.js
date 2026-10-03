const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const forgotPasswordController = require('../controllers/forgotPasswordController');
const validate = require('../middlewares/validate');
const { requestPasswordResetOtpSchema, resetPasswordSchema } = require('../middlewares/validations/forgotPasswordValidations');

router.get('/registration-config', authController.getRegistrationConfig);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

// Forgot password (public) - gated by isForgotPasswordFunctionalityOn in the service.
router.get('/forgot-password/config', forgotPasswordController.getForgotPasswordConfig);
router.post('/forgot-password/request-otp', validate(requestPasswordResetOtpSchema, 'body'), forgotPasswordController.requestPasswordResetOtp);
router.post('/forgot-password/reset', validate(resetPasswordSchema, 'body'), forgotPasswordController.resetPassword);

module.exports = router;