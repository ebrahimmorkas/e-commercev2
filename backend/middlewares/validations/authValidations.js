const Joi = require('joi');

// Same rules as the admin-created customer (createUserAdminSchema in
// userValidations.js) - a customer who signs up and one the admin adds must
// end up with identically valid accounts.
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const PHONE_LENGTH_MESSAGE = '{{#label}} must be 10 to 14 digits long.';
const PHONE_PATTERN_MESSAGE = '{{#label}} must be 10 to 14 digits, with an optional leading +.';
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const USERNAME_PATTERN_MESSAGE = '{{#label}} may only contain lowercase letters, numbers, dots and underscores.';
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_PATTERN_MESSAGE = '{{#label}} must contain at least one uppercase letter, one lowercase letter and one number.';

// Storefront self-registration (POST /api/auth/register).
//
// Mirrors User.js (name 2-50, phone_no / whatsapp_no 10-14, email and username
// lowercase) so a bad value is answered with a 400 and a readable message
// instead of reaching Mongoose and surfacing as a 500.
//
// Left to the controller / service, because they depend on the vendor's own
// settings which a static schema can't see:
//   - whether city is required (CompanySettings.isCityOptional)
//   - whether the tax details are honoured, and that business name + TRN are
//     both present when they are (isTaxRegistrationOnSignupEnabled)
//   - that country / state / city are real, allowed and belong together
const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required().label('Name'),
    username: Joi.string().trim().lowercase().min(3).max(30)
        .pattern(USERNAME_PATTERN)
        .required()
        .label('Username')
        .messages({ 'string.pattern.base': USERNAME_PATTERN_MESSAGE }),
    email: Joi.string().trim().lowercase().email().max(254).required().label('Email'),
    phone_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .required()
        .label('Phone number')
        .messages({
            'string.min': PHONE_LENGTH_MESSAGE,
            'string.max': PHONE_LENGTH_MESSAGE,
            'string.pattern.base': PHONE_PATTERN_MESSAGE
        }),
    // Optional: an empty value is treated as "not given", so it never reaches
    // the model's minlength check as an empty string.
    whatsapp_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .empty(['', null])
        .label('WhatsApp number')
        .messages({
            'string.min': PHONE_LENGTH_MESSAGE,
            'string.max': PHONE_LENGTH_MESSAGE,
            'string.pattern.base': PHONE_PATTERN_MESSAGE
        }),
    password: Joi.string().min(8).max(128)
        .pattern(PASSWORD_PATTERN)
        .required()
        .label('Password')
        .messages({ 'string.pattern.base': PASSWORD_PATTERN_MESSAGE }),
    // Encoded CountryMaster / StateMaster / CityMaster ids from the signup dropdowns.
    country: Joi.string().trim().max(200).required().label('Country')
        .messages({ 'string.empty': 'Please select a country.', 'any.required': 'Please select a country.' }),
    state: Joi.string().trim().max(200).required().label('State')
        .messages({ 'string.empty': 'Please select a state.', 'any.required': 'Please select a state.' }),
    city: Joi.string().trim().max(200).empty(['', null]).label('City'),
    isTaxRegistered: Joi.boolean().label('Tax registered'),
    businessFullName: Joi.string().trim().max(100).empty(['', null]).label('Business full name'),
    // Its 15-digit format is checked in the controller, only when the tax
    // details are actually honoured for this vendor.
    trn: Joi.string().trim().max(50).empty(['', null]).label('TRN')
});

module.exports = {
    registerSchema
};
