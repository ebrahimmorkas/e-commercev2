const Joi = require('joi');
const { GIVE_DISCOUNT_TO_CONFIG, VALID_DISCOUNT_TYPES, VALID_DAYS } = require('../../constants/discountConstants');
const { DEFAULT_DISCOUNT_TIMEZONE, DATE_ONLY_PATTERN, TIME_PATTERN, isValidTimezone } = require('../../utils/discountSchedule');

// Discount ids (own _id and the group-id arrays submitted directly by the
// client) are common.encodeId-encoded, never raw hex ObjectIds - loose
// opaque-string check, decoded via common.decodeId in the controller.
const objectId = () => Joi.string().trim().min(1).messages({
  'string.min': '{{#label}} must be a valid id.',
});

// --- Add / update discount --------------------------------------------------
// The body is JSON, or multipart/form-data when an excel file is attached -
// in which case every value arrives as a string ("true", "12.5"). Joi's
// conversion turns them back into real booleans/numbers, which is what
// discountService's strict `=== true` checks rely on.

const giveDiscountToValues = Object.keys(GIVE_DISCOUNT_TO_CONFIG);
const unsupportedGiveDiscountTo = giveDiscountToValues.filter((key) => GIVE_DISCOUNT_TO_CONFIG[key].notSupported);
const targetsNeeding = (flag) => giveDiscountToValues.filter((key) => GIVE_DISCOUNT_TO_CONFIG[key][flag]);

const bool = () => Joi.boolean().truthy('true').falsy('false').default(false);

// Group ids: required (non-empty) for the targeting options that use them, dropped otherwise.
const groupIdsFor = (flag, label) => Joi.when('giveDiscountTo', {
  is: Joi.valid(...targetsNeeding(flag)),
  then: Joi.array().items(objectId()).single().min(1).max(100).unique().required().label(label),
  otherwise: Joi.any().strip()
});

const onlyWhenTrue = (flag, schema) => Joi.when(flag, { is: true, then: schema.required(), otherwise: Joi.any().strip() });

const dateOnly = (label) => Joi.string().trim().pattern(DATE_ONLY_PATTERN).label(label)
  .messages({ 'string.pattern.base': '{{#label}} must be a date in YYYY-MM-DD format.' });

const time = (label) => Joi.string().trim().pattern(TIME_PATTERN).label(label)
  .messages({ 'string.pattern.base': '{{#label}} must be a time in HH:mm (24-hour) format.' });

const discountBodyKeys = {
  name: Joi.string().trim().min(1).max(200).required().label('Discount name'),
  description: Joi.string().trim().allow('').max(2000).default('').label('Description'),
  remarks: Joi.string().trim().allow('').max(2000).default('').label('Remarks'),
  internalNotes: Joi.string().trim().allow('').max(2000).default('').label('Internal notes'),

  discountType: Joi.string().valid(...VALID_DISCOUNT_TYPES).required().label('Discount type'),
  discountValue: Joi.when('discountType', {
    is: 'PERCENTAGE',
    then: Joi.number().greater(0).max(100).precision(2).required(),
    otherwise: Joi.number().greater(0).max(100000000).precision(2).required()
  }).label('Discount value'),

  giveDiscountTo: Joi.string().valid(...giveDiscountToValues).invalid(...unsupportedGiveDiscountTo).required().label('Give discount to')
    .messages({ 'any.invalid': 'This targeting option is not supported yet - choose a different one.' }),
  productGroupIds: groupIdsFor('needsProductGroupIds', 'Product groups'),
  categoryGroupIds: groupIdsFor('needsCategoryGroupIds', 'Category groups'),
  userGroupIds: groupIdsFor('needsUserGroupIds', 'User groups'),

  precedence: Joi.number().integer().min(0).max(1000000).empty('').default(0).label('Precedence'),
  autoApply: bool().label('Auto apply'),

  isOngoingDiscount: bool().label('Ongoing discount'),
  isMinimumDiscountQuantityDiscount: bool().label('Minimum quantity discount'),
  isCouponCodeDiscount: bool().label('Coupon code discount'),

  // Whole calendar days in `timezone` (see utils/discountSchedule.js).
  startDate: Joi.when('isOngoingDiscount', { is: true, then: Joi.any().strip(), otherwise: dateOnly('Start date').required() }),
  endDate: Joi.when('isOngoingDiscount', { is: true, then: Joi.any().strip(), otherwise: dateOnly('End date').required() }),
  timezone: Joi.string().trim().empty('').default(DEFAULT_DISCOUNT_TIMEZONE).label('Timezone')
    .custom((value, helpers) => (isValidTimezone(value) ? value : helpers.error('timezone.invalid')))
    .messages({ 'timezone.invalid': '{{#label}} must be a valid IANA timezone, e.g. Asia/Kolkata.' }),

  minimumQuantity: onlyWhenTrue('isMinimumDiscountQuantityDiscount', Joi.number().integer().min(1).max(100000).label('Minimum quantity')),
  couponCode: onlyWhenTrue('isCouponCodeDiscount', Joi.string().trim().uppercase().min(3).max(30).pattern(/^[A-Z0-9_-]+$/).label('Coupon code')
    .messages({ 'string.pattern.base': '{{#label}} can only contain letters, numbers, "-" and "_".' })),
  discountValidAboveAmount: Joi.number().min(0).max(100000000).precision(2).empty('').default(0).label('Minimum cart value'),

  isDiscountOpenForSpecificDays: bool().label('Specific days'),
  specificDays: onlyWhenTrue('isDiscountOpenForSpecificDays', Joi.array().items(Joi.string().trim().uppercase().valid(...VALID_DAYS)).single().min(1).unique().label('Specific days')),
  isDiscountOpenForSpecificHours: bool().label('Specific hours'),
  specificHoursStartTime: onlyWhenTrue('isDiscountOpenForSpecificHours', time('Start time')),
  specificHoursEndTime: onlyWhenTrue('isDiscountOpenForSpecificHours', time('End time')),

  isDiscountBasedOnPaymentMethods: bool().label('Payment method discount'),
  discountOnPaymentMethods: onlyWhenTrue('isDiscountBasedOnPaymentMethods', Joi.array().items(Joi.string().trim().uppercase().min(1).max(50)).single().min(1).unique().label('Payment methods')),

  numberOfUsersCanUseDiscount: Joi.number().integer().min(1).max(100000000).empty('').allow(null).default(null).label('Number of customers'),
  isMultipleDiscountUsageOn: bool().label('Combine with other discounts'),
  isDiscountReusable: bool().label('Reusable'),
  discountReusableNumber: onlyWhenTrue('isDiscountReusable', Joi.number().integer().min(1).max(1000).label('Reuse count')),
  firstOrderOnly: bool().label('First order only'),

  notifyCustomers: bool().label('Notify customers by email')
};

// Rules that span several fields.
const discountCrossFieldRules = (value, helpers) => {
  const primaryFlows = [value.isOngoingDiscount, value.isMinimumDiscountQuantityDiscount, value.isCouponCodeDiscount].filter(Boolean);
  if (primaryFlows.length > 1) {
    return helpers.message('Choose only one of Ongoing, Minimum Quantity or Coupon Code.');
  }
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    return helpers.message('End date cannot be before start date.');
  }
  if (value.isDiscountOpenForSpecificDays && !value.isMinimumDiscountQuantityDiscount && !value.isCouponCodeDiscount) {
    return helpers.message('Specific days can only be used with a Minimum Quantity or Coupon Code discount.');
  }
  if (value.isDiscountOpenForSpecificHours && !value.isDiscountOpenForSpecificDays) {
    return helpers.message('Specific hours can only be used together with specific days.');
  }
  if (value.isDiscountOpenForSpecificHours && value.specificHoursStartTime === value.specificHoursEndTime) {
    return helpers.message('Start time and end time cannot be the same.');
  }
  if (value.isCouponCodeDiscount && value.autoApply) {
    return helpers.message('A coupon code discount cannot be auto-applied - customers must enter the code.');
  }
  if (value.firstOrderOnly && value.isDiscountReusable) {
    return helpers.message('A first-order-only discount cannot also be reusable.');
  }
  // First order only already allows exactly one order in total.
  if (value.firstOrderOnly && value.numberOfUsersCanUseDiscount !== null && value.numberOfUsersCanUseDiscount !== undefined) {
    return helpers.message('Use either "First order only" or a maximum number of customers, not both.');
  }
  return value;
};

const createDiscountSchema = Joi.object(discountBodyKeys).custom(discountCrossFieldRules);

// GET /discount/excel-sample?giveDiscountTo=... - only the options set up by excel.
const excelTargetingValues = giveDiscountToValues.filter((key) => {
  const config = GIVE_DISCOUNT_TO_CONFIG[key];
  return config.needsProductsFile || config.needsCategoriesFile || config.needsUsersFile;
});
const excelSampleQuerySchema = Joi.object({
  giveDiscountTo: Joi.string().valid(...excelTargetingValues).required().label('Give discount to')
    .messages({ 'any.only': 'This targeting option does not use an excel file.' })
});

const updateDiscountSchema = Joi.object({
  ...discountBodyKeys,
  status: Joi.string().valid('A', 'I').label('Status')
}).custom(discountCrossFieldRules);

// --- Bulk status / delete (multi-select checkbox actions) --------------------
const bulkDiscountStatusSchema = Joi.object({
  discountIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Discount IDs'),
  status: Joi.string().valid('A', 'I').required().label('Status'),
  // Only used when activating - emails the customers again.
  notifyCustomers: Joi.boolean().default(false).label('Notify customers by email')
});

const bulkDeleteDiscountSchema = Joi.object({
  discountIds: Joi.array().items(objectId()).min(1).max(50).unique().required().label('Discount IDs')
});

const bulkProductNameRowSchema = Joi.object({
  productName: Joi.string().trim().min(1).required().label('Product name'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

const bulkCategoryNameRowSchema = Joi.object({
  categoryName: Joi.string().trim().min(1).required().label('Category name'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

const bulkUserEmailRowSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required().label('Email'),
  __rowNumber: Joi.number().optional()
}).unknown(false);

module.exports = {
  createDiscountSchema,
  updateDiscountSchema,
  excelSampleQuerySchema,
  bulkProductNameRowSchema,
  bulkCategoryNameRowSchema,
  bulkUserEmailRowSchema,
  bulkDiscountStatusSchema,
  bulkDeleteDiscountSchema
};