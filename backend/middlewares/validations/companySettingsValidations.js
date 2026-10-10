const Joi = require('joi');

// A list of email addresses; blanks are dropped and duplicates rejected.
const emailList = () =>
    Joi.array()
        .items(Joi.string().trim().lowercase().email().allow(''))
        .single()
        .max(50)
        .custom((list) => list.filter(Boolean))
        .unique((a, b) => a && a === b);

const { VALID_EMAIL_MODULES } = require('../../constants/emailModuleConstants');
const { MAX_LOW_STOCK_THRESHOLD } = require('../../constants/inventoryConstants');

// Loose opaque-string check rather than hex/length - templateId here refers
// to EmailTemplateMaster, whose ids are now common.encodeId-encoded (not raw
// hex). Other id fields sharing this helper (currencyId/countryId/stateId
// etc.) still hold raw ObjectIds for now - this check accepts both, since
// it's a superset, not a narrowing.
const objectId = () => Joi.string().trim().min(1).messages({
    'string.min': '{{#label}} must be a valid id.',
});

// currencyId/orderCancellationNotAllowedAfterStep may legitimately arrive as
// an empty string or the literal "null" when sent via multipart/form-data
// (companyLogo/paymentScanner uploads force the request into multipart, so
// every other field arrives as a string) - normalize those to actual null
// before Joi sees them, same convention as categoryValidations.js.
const nullableObjectId = () => Joi.alternatives().try(
    objectId(),
    Joi.string().valid('', 'null')
).custom((value) => (value === '' || value === 'null' ? null : value)).allow(null);

const phonePattern = /^[0-9+\-\s()]{7,15}$/;

// A step code of the vendor's assigned order workflow (whether it really is
// one is checked in companySettingsService against the workflow). ''/'null'
// (multipart) clear it - listed first so 'null' isn't taken as a code.
const nullableStepCode = () => Joi.alternatives().try(
    Joi.string().valid('', 'null'),
    Joi.string().trim().uppercase().max(50).pattern(/^[A-Z0-9_]+$/)
        .messages({ 'string.pattern.base': '{{#label}} must be one of your order steps.' })
).custom((value) => (value === '' || value === 'null' ? null : value)).allow(null);

const companySettingsFieldsSchema = {
    currencyId: nullableObjectId().label('Currency'),
    storeCountryId: nullableObjectId().label('Store country'),
    storeStateId: nullableObjectId().label('Store state'),
    storeCityId: nullableObjectId().label('Store city'),
    adminName: Joi.string().trim().min(2).max(100).label('Admin name'),
    adminWhatsappNumber: Joi.string().trim().pattern(phonePattern).allow('', null).label('Admin WhatsApp number'),
    adminPhoneNumber: Joi.string().trim().pattern(phonePattern).allow('', null).label('Admin phone number'),
    adminAddress: Joi.string().trim().max(300).allow('', null).label('Admin address'),
    adminCity: Joi.string().trim().max(100).allow('', null).label('Admin city'),
    adminState: Joi.string().trim().max(100).allow('', null).label('Admin state'),
    adminPincode: Joi.string().trim().max(10).allow('', null).label('Admin pincode'),
    adminEmail: Joi.string().trim().lowercase().email().label('Admin email'),
    companyName: Joi.string().trim().max(150).allow('', null).label('Company name'),
    instagramId: Joi.string().trim().max(100).allow('', null).label('Instagram ID'),
    facebookId: Joi.string().trim().max(100).allow('', null).label('Facebook ID'),
    privacyPolicy: Joi.string().allow('', null).label('Privacy policy'),
    cancelPolicy: Joi.string().allow('', null).label('Cancel policy'),
    termsAndConditions: Joi.string().allow('', null).label('Terms and conditions'),
    aboutUs: Joi.string().allow('', null).label('About us'),
    returnRefundPolicy: Joi.string().allow('', null).label('Return and refund policy'),
    policyDisplayMode: Joi.string().valid('PAGE', 'MODAL').label('Policy display mode'),
    // Storefront Contact Us - separate from adminEmail/adminPhoneNumber/adminAddress above.
    contactEmail: Joi.string().trim().lowercase().email().allow('', null).label('Contact email'),
    contactPhoneNumber: Joi.string().trim().pattern(phonePattern).allow('', null).label('Contact phone number'),
    contactAddress: Joi.string().trim().max(300).allow('', null).label('Contact address'),
    showAnnouncements: Joi.boolean().label('Show announcements'),
    isAnnouncementRotationOn: Joi.boolean().label('Announcement rotation'),
    showBanners: Joi.boolean().label('Show banners'),
    isBannerRotationOn: Joi.boolean().label('Banner rotation'),
    isTaxRegistrationOnSignupEnabled: Joi.boolean().label('Ask for tax registration at signup'),
    isCityOptional: Joi.boolean().label('Make city optional'),
    // Seller-side invoice details (see invoiceService.js). All optional; blank clears them.
    taxRegistrationNumber: Joi.string().trim().pattern(/^\d{15}$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} must be exactly 15 digits.' })
        .label('Tax Registration Number (TRN)'),
    invoicePrefix: Joi.string().trim().uppercase().pattern(/^[A-Z0-9]{1,10}$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} may only contain letters and numbers (up to 10).' })
        .label('Invoice prefix'),
    invoiceDeclaration: Joi.string().trim().max(500).allow('', null).label('Invoice declaration'),
    invoicePrintDuplicateCopy: Joi.boolean().label('Print original and duplicate copies'),
    invoiceRoundOffToWhole: Joi.boolean().label('Round invoice total to a whole amount'),
    emailInvoiceOnOrderPlaced: Joi.boolean().label('Email invoice when an order is placed'),
    showReviewsToCustomers: Joi.boolean().label('Show reviews to customers'),
    isProductCodeAutoGenerated: Joi.boolean().label('Auto-generate product code'),
    isVariantCodeAutoGenerated: Joi.boolean().label('Auto-generate variant code'),
    isSizeCodeAutoGenerated: Joi.boolean().label('Auto-generate size code'),
    shouldProductsBeHiddenWhenLocationsAreExcluded: Joi.boolean().label('Hide products for excluded locations'),
    useShortNameForBrand: Joi.boolean().label('Use short name for brand'),
    // Low stock alert (Company Settings > Product). The threshold is a whole
    // number, required once the alert is switched on; a blank one is ignored.
    receiveLowStockAlert: Joi.boolean().label('Receive low stock alert'),
    lowStockAlertThreshold: Joi.number().integer().min(0).max(MAX_LOW_STOCK_THRESHOLD)
        .empty(Joi.valid('', null, 'null'))
        .when('receiveLowStockAlert', { is: true, then: Joi.required() })
        .messages({
            'any.required': 'Enter the stock quantity at which you want to receive the low stock alert.',
            'number.base': '{{#label}} must be a number.',
            'number.integer': '{{#label}} must be a whole number.',
            'number.min': '{{#label}} cannot be negative.',
            'number.max': '{{#label}} cannot be more than {{#limit}}.',
            'number.unsafe': '{{#label}} is too large.'
        })
        .label('Low stock alert threshold'),
    allowOutOfStockProductsAdding: Joi.boolean().label('Allow out-of-stock products to be added to cart'),
    fewItemsReturnOnly: Joi.boolean().label('Few items return only'),
    fewItemsExchangeOnly: Joi.boolean().label('Few items exchange only'),
    isOrderCancellationAllowed: Joi.boolean().label('Order cancellation allowed'),
    orderCancellationNotAllowedAfterStep: nullableStepCode().label('Order cancellation cutoff step'),
    // null = the workflow's last step.
    markPaymentCompletedAtStep: nullableStepCode().label('Mark payment as done at step'),
    // Both or neither, and "to" must be the step right after "from" - checked
    // in companySettingsService against the workflow.
    deliveryAgentFromStep: nullableStepCode().label('Delivery agent - from step'),
    deliveryAgentToStep: nullableStepCode().label('Delivery agent - to step'),
    isOrderNumberAutoGenerated: Joi.boolean().label('Auto-generate order number'),
    senderEmail: Joi.string().trim().lowercase().email().allow('', null).label('Sender email'),
    // An emptied list is sent as a single '' (multipart can't carry an empty
    // array) - allowed here and dropped, so the list is cleared.
    ccList: emailList().label('CC list'),
    bccList: emailList().label('BCC list'),
    useDefaultEmailTemplate: Joi.boolean().label('Use default email template'),
    discountEmailRecipients: Joi.string().valid('TARGETED', 'ALL').label('Who gets discount emails'),
    discountExpiryReminderDays: Joi.number().integer().min(1).max(60).label('Discount reminder days before expiry'),
    freeCashEmailRecipients: Joi.string().valid('TARGETED', 'ALL').label('Who gets Free Cash emails'),
    freeCashExpiryReminderDays: Joi.number().integer().min(1).max(60).label('Free Cash reminder days before expiry'),
    isPaymentGatewayFeatureOn: Joi.boolean().label('Online payment enabled'),
    isCODFeatureOn: Joi.boolean().label('Cash on Delivery enabled'),
    gpayNumber: Joi.string().trim().pattern(/^\+?[0-9 ]{7,15}$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} must be a valid phone number.' })
        .label('GPay number'),
    isFreeCashFeatureOn: Joi.boolean().label('Show Free Cash'),
    isFreeCashStackingAllowed: Joi.boolean().label('Allow Free Cash stacking'),
    isMultipleFreeCashUsageAllowed: Joi.boolean().label('Allow multiple Free Cash usage per order'),
    isStoringRemainingFreeCashAmountAllowed: Joi.boolean().label('Store remaining Free Cash amount for reuse'),
    returnFreeCashOnOrderReturn: Joi.boolean().label('Refund Free Cash on order return'),
    refundWholeFreeCashAmount: Joi.boolean().label('Refund the whole Free Cash amount used'),
    // Only meaningful (and only ever stored) when returnFreeCashOnOrderReturn
    // is true and refundWholeFreeCashAmount is false - companySettingsService
    // normalizes it back to null server-side whenever either condition
    // doesn't hold. Rejected here only when it contradicts
    // refundWholeFreeCashAmount within the SAME request.
    amountToRefund: Joi.number().min(0).max(100).allow(null)
        .when('refundWholeFreeCashAmount', {
            is: true,
            then: Joi.valid(null).messages({ 'any.only': 'amountToRefund is not applicable when refundWholeFreeCashAmount is true.' })
        })
        .label('Free Cash refund percentage'),
    timeForAbondonedCartReflection: Joi.number().integer().min(1).max(10080).label('Abandoned cart reflection time (minutes)'),
    abondonedCartOnlyForLoggedInUsers: Joi.boolean().label('Show abandoned carts for logged-in users only'),

    // Bank Transfer - gated by CompanyMaster.showPaymentQRCodeAndBankDetails
    // (+ WebsiteMaster.isShowingPaymentQRCodeAndBankDetailsFeatureOn),
    // enforced in companySettingsService.js, not here. Each field is
    // independently optional - a vendor may save partial bank info and fill
    // in the rest later, same convention as adminAddress/instagramId etc.
    bankAccountHolderName: Joi.string().trim().min(2).max(150).allow('', null).label('Bank account holder name'),
    bankName: Joi.string().trim().min(2).max(150).allow('', null).label('Bank name'),
    // Alphanumeric to also accommodate IBAN-style account numbers, not just
    // numeric domestic account numbers.
    bankAccountNumber: Joi.string().trim().pattern(/^[A-Za-z0-9]{4,34}$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} must be 4-34 alphanumeric characters.' })
        .label('Bank account number'),
    // Indian IFSC format: 4 letters, a literal 0, then 6 alphanumeric chars.
    ifscCode: Joi.string().trim().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} must be a valid IFSC code (e.g. ABCD0123456).' })
        .label('IFSC code'),
    branchName: Joi.string().trim().max(150).allow('', null).label('Branch name'),
    // SWIFT/BIC format: 8 chars, optionally 11 with a branch code suffix.
    swiftCode: Joi.string().trim().uppercase().pattern(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).allow('', null)
        .messages({ 'string.pattern.base': '{{#label}} must be a valid SWIFT/BIC code (8 or 11 characters).' })
        .label('SWIFT code'),
    bankAccountType: Joi.alternatives().try(
        Joi.string().valid('SAVINGS', 'CURRENT'),
        Joi.string().valid('', 'null')
    ).custom((value) => (value === '' || value === 'null' ? null : value)).allow(null).label('Bank account type')
};

const createCompanySettingsSchema = Joi.object({
    ...companySettingsFieldsSchema,
    adminName: companySettingsFieldsSchema.adminName.required(),
    adminEmail: companySettingsFieldsSchema.adminEmail.required()
});

// Deliberately no .min(1) here - an update may legitimately carry zero body
// fields when it's only replacing companyLogo/paymentScanner (files live on
// req.files, not req.body, so Joi can't see them). The "nothing to update at
// all" case (no fields AND no files) is instead checked in the controller,
// which can see both.
const updateCompanySettingsSchema = Joi.object(companySettingsFieldsSchema);

const assignEmailTemplateSchema = Joi.object({
    module: Joi.string().valid(...VALID_EMAIL_MODULES).required().label('Module'),
    templateId: objectId().required().label('Template ID')
});

const unassignEmailTemplateSchema = Joi.object({
    module: Joi.string().valid(...VALID_EMAIL_MODULES).required().label('Module')
});

// --- Email tab: attachments and images (multipart: the file is req.file) ---
const addEmailAttachmentSchema = Joi.object({
    // The file name the customer sees; the uploaded file's name when left empty.
    displayName: Joi.string().trim().max(150).allow('', null).label('Display name')
});

const addEmailImageSchema = Joi.object({
    // The short name a template uses to place the image, e.g. {{image:logo}}.
    name: Joi.string().trim().lowercase().min(2).max(40).pattern(/^[a-z0-9][a-z0-9_-]*$/).required().label('Image name')
        .messages({ 'string.pattern.base': 'Image name may only contain lowercase letters, numbers, - and _, and must start with a letter or number.' })
});

// The vendor's own email account (SMTP). password is optional on a re-save
// (the saved one is kept); the service still requires one to exist.
const saveEmailAccountSchema = Joi.object({
    host: Joi.string().trim().hostname().max(200).required().label('Email server'),
    port: Joi.number().integer().min(1).max(65535).required().label('Port'),
    security: Joi.string().valid('SSL', 'STARTTLS', 'NONE').required().label('Security'),
    username: Joi.string().trim().min(1).max(200).required().label('Username'),
    password: Joi.string().min(1).max(500).allow('', null).label('Password'),
    fromEmail: Joi.string().trim().lowercase().email().allow('', null).label('From address'),
    fromName: Joi.string().trim().max(100).allow('', null).label('From name')
});

const sendTestEmailSchema = Joi.object({
    to: Joi.string().trim().lowercase().email().allow('', null).label('Send the test to')
});

const emailContentIdParamSchema = Joi.object({
    id: objectId().required().label('Id')
});

module.exports = {
    saveEmailAccountSchema,
    sendTestEmailSchema,
    addEmailAttachmentSchema,
    addEmailImageSchema,
    emailContentIdParamSchema,
    createCompanySettingsSchema,
    updateCompanySettingsSchema,
    assignEmailTemplateSchema,
    unassignEmailTemplateSchema
};
