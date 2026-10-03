const Joi = require('joi');
const { OTP_LENGTH } = require('../../constants/forgotPasswordConstants');

// Same password rule as changePasswordAdminSchema in userValidations.js.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_PATTERN_MESSAGE = '{{#label}} must contain at least one uppercase letter, one lowercase letter and one number.';
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

// 254 = the longest address an email can legally have. Lowercased because
// User.email is stored lowercase.
const email = () => Joi.string().trim().lowercase().email().max(254).required().label('Email').messages({
    'string.email': '{{#label}} must be a valid email address.',
    'string.empty': '{{#label}} is required.'
});

const requestPasswordResetOtpSchema = Joi.object({
    email: email()
});

const resetPasswordSchema = Joi.object({
    email: email(),
    otp: Joi.string().trim().pattern(OTP_PATTERN).required().label('Code').messages({
        'string.pattern.base': `{{#label}} must be exactly ${OTP_LENGTH} digits.`,
        'string.empty': '{{#label}} is required.'
    }),
    // Not trimmed - a password is taken exactly as typed, so leading/trailing
    // spaces are refused instead of silently dropped.
    newPassword: Joi.string().min(8).max(128)
        .pattern(PASSWORD_PATTERN)
        .pattern(/^\S(.*\S)?$/, 'no surrounding spaces')
        .required()
        .label('New password')
        .messages({
            'string.pattern.base': PASSWORD_PATTERN_MESSAGE,
            'string.pattern.name': '{{#label}} cannot start or end with a space.',
            'string.empty': '{{#label}} is required.'
        }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().label('Confirm password').messages({
        'any.only': '{{#label}} must match the new password.',
        'string.empty': '{{#label}} is required.'
    })
});

module.exports = {
    requestPasswordResetOtpSchema,
    resetPasswordSchema
};
