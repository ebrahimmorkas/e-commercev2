const Joi = require('joi');
const {
    VALID_CUSTOMER_LIST_SORTS,
    DEFAULT_CUSTOMER_LIST_SORT,
    CUSTOMER_LIST_PAGE_SIZES,
    DEFAULT_CUSTOMER_LIST_PAGE_SIZE,
    VALID_CUSTOMER_ACTIVITY_FILTERS,
    VALID_CUSTOMER_LOGIN_FILTERS,
    CUSTOMER_LIST_SEARCH_MAX_LENGTH
} = require('../../constants/customerListConstants');

// User ids are common.encodeId-encoded (see formatUserForResponse in
// userController), never a raw hex ObjectId - so this is a loose
// opaque-string check, not a hex/length one. Decoded via common.decodeId in
// the controller before reaching the service.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// Shared across the profile-update, admin-create and password-change schemas
// below so the three stay in lockstep instead of drifting.
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const PHONE_PATTERN_MESSAGE = '{{#label}} must contain only digits, with an optional leading +.';
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const USERNAME_PATTERN_MESSAGE = '{{#label}} may only contain lowercase letters, numbers, dots and underscores.';
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_PATTERN_MESSAGE = '{{#label}} must contain at least one uppercase letter, one lowercase letter and one number.';

// --- Single-record get / update / delete (admin) ------------------------------
const userIdParamSchema = Joi.object({
    id: objectId().required().label('User ID')
});

// Mirrors User.js field constraints (name/phone_no/whatsapp_no min/max length,
// email/username lowercase) plus reasonable format rules the model itself
// doesn't enforce (username charset, phone digit pattern, email format).
// Deliberately excludes password/role/status/authProvider/googleId - those
// are not editable through this generic profile-update endpoint.
const updateUserAdminSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).label('Name'),
    username: Joi.string().trim().lowercase().min(3).max(30)
        .pattern(USERNAME_PATTERN)
        .label('Username')
        .messages({ 'string.pattern.base': USERNAME_PATTERN_MESSAGE }),
    email: Joi.string().trim().lowercase().email().label('Email'),
    phone_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .label('Phone number')
        .messages({ 'string.pattern.base': PHONE_PATTERN_MESSAGE }),
    whatsapp_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .label('WhatsApp number')
        .messages({ 'string.pattern.base': PHONE_PATTERN_MESSAGE }),
    country: Joi.string().trim().label('Country'),
    state: Joi.string().trim().label('State'),
    // '' / null clears the city - userService allows that only while the
    // vendor's CompanySettings.isCityOptional is on.
    city: Joi.string().trim().max(200).allow('', null).label('City')
}).min(1).messages({ 'object.min': 'At least one field must be provided to update.' });

// Admin creating a customer account directly - same required fields as
// self-registration (authService.registerUser), just entered by the admin
// instead of the customer. role/authProvider are not accepted here: role
// always defaults to "user" (matching User.js) and authProvider is always
// "local" for an admin-created account.
const createUserAdminSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required().label('Name'),
    username: Joi.string().trim().lowercase().min(3).max(30)
        .pattern(USERNAME_PATTERN)
        .required()
        .label('Username')
        .messages({ 'string.pattern.base': USERNAME_PATTERN_MESSAGE }),
    email: Joi.string().trim().lowercase().email().required().label('Email'),
    phone_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .required()
        .label('Phone number')
        .messages({ 'string.pattern.base': PHONE_PATTERN_MESSAGE }),
    whatsapp_no: Joi.string().trim().min(10).max(14)
        .pattern(PHONE_PATTERN)
        .label('WhatsApp number')
        .messages({ 'string.pattern.base': PHONE_PATTERN_MESSAGE }),
    password: Joi.string().min(8).max(128)
        .pattern(PASSWORD_PATTERN)
        .required()
        .label('Password')
        .messages({ 'string.pattern.base': PASSWORD_PATTERN_MESSAGE }),
    country: Joi.string().trim().required().label('Country'),
    state: Joi.string().trim().required().label('State'),
    // Whether city is required depends on the vendor's
    // CompanySettings.isCityOptional, which a static schema can't see - so it
    // is optional here and enforced in userService (userLocationService).
    city: Joi.string().trim().max(200).allow('', null).label('City')
});

// Admin-driven password reset - deliberately stricter than a bare
// model-level check since a weak admin-set password is as much a risk as a
// weak self-chosen one.
const changePasswordAdminSchema = Joi.object({
    newPassword: Joi.string()
        .min(8)
        .max(128)
        .pattern(PASSWORD_PATTERN)
        .required()
        .label('New password')
        .messages({ 'string.pattern.base': PASSWORD_PATTERN_MESSAGE })
});

// Customers page list: customers (default) or the vendor's delivery agents.
const listUsersAdminQuerySchema = Joi.object({
    role: Joi.string().valid('user', 'deliveryAgent').default('user').label('Role')
});

// Customers page (paginated): search, filters and sort all run on the server.
// joinedFrom / joinedTo are full ISO date-times - the page sends the start and
// end of the picked days in the admin's own timezone, so the server never has
// to guess one.
const listCustomersAdminQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).max(100000).default(1).label('Page'),
    limit: Joi.number().integer().valid(...CUSTOMER_LIST_PAGE_SIZES)
        .default(DEFAULT_CUSTOMER_LIST_PAGE_SIZE)
        .messages({ 'any.only': `{{#label}} must be one of ${CUSTOMER_LIST_PAGE_SIZES.join(', ')}.` })
        .label('Per page'),
    q: Joi.string().trim().allow('').max(CUSTOMER_LIST_SEARCH_MAX_LENGTH).label('Search'),
    sort: Joi.string().trim().valid(...VALID_CUSTOMER_LIST_SORTS).default(DEFAULT_CUSTOMER_LIST_SORT)
        .messages({ 'any.only': `{{#label}} must be one of: ${VALID_CUSTOMER_LIST_SORTS.join(', ')}.` })
        .label('Sort'),
    status: Joi.string().trim().valid('A', 'I')
        .messages({ 'any.only': '{{#label}} must be Active (A) or Inactive (I).' })
        .label('Status'),
    orders: Joi.string().trim().valid(...VALID_CUSTOMER_ACTIVITY_FILTERS)
        .messages({ 'any.only': `{{#label}} must be one of: ${VALID_CUSTOMER_ACTIVITY_FILTERS.join(', ')}.` })
        .label('Orders filter'),
    reviews: Joi.string().trim().valid(...VALID_CUSTOMER_ACTIVITY_FILTERS)
        .messages({ 'any.only': `{{#label}} must be one of: ${VALID_CUSTOMER_ACTIVITY_FILTERS.join(', ')}.` })
        .label('Reviews filter'),
    login: Joi.string().trim().valid(...VALID_CUSTOMER_LOGIN_FILTERS)
        .messages({ 'any.only': `{{#label}} must be one of: ${VALID_CUSTOMER_LOGIN_FILTERS.join(', ')}.` })
        .label('Login filter'),
    joinedFrom: Joi.date().iso().label('Joined from')
        .messages({ 'date.format': '{{#label}} must be a valid date.', 'date.base': '{{#label}} must be a valid date.' }),
    joinedTo: Joi.date().iso().label('Joined to')
        .when('joinedFrom', { is: Joi.exist(), then: Joi.date().min(Joi.ref('joinedFrom')) })
        .messages({
            'date.format': '{{#label}} must be a valid date.',
            'date.base': '{{#label}} must be a valid date.',
            'date.min': 'Joined to cannot be before Joined from.'
        })
});

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkUserStatusSchema = Joi.object({
    userIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Customer IDs'),
    status: Joi.string().valid('A', 'I').required().label('Status')
});

const bulkDeleteUserSchema = Joi.object({
    userIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Customer IDs')
});

module.exports = {
    listUsersAdminQuerySchema,
    listCustomersAdminQuerySchema,
    userIdParamSchema,
    createUserAdminSchema,
    updateUserAdminSchema,
    changePasswordAdminSchema,
    bulkUserStatusSchema,
    bulkDeleteUserSchema
};
