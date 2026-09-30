const mongoose = require('mongoose');
const Discount = require('../models/Discount');
// NOTE: these models do not exist yet in the codebase. Paths/field names are
// wired per the field names confirmed by the team (productName, categoryName, email).
// Requires will fail until these models are created - that's expected for now.
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Group = require('../models/Group');
const promotionEmailService = require('./promotionEmailService');

const logger = require('../utils/logger');
const common = require('../utils/common');
const { safeParseExcelSheet } = require('../utils/excelParser');
const { buildExcelTemplate } = require('../utils/excelTemplateBuilder');
const { processExcelRows } = require('../utils/excelRowProcessor');
const {
  bulkProductNameRowSchema,
  bulkCategoryNameRowSchema,
  bulkUserEmailRowSchema
} = require('../middlewares/validations/discountValidations');
const {
  GIVE_DISCOUNT_TO_CONFIG,
  PRODUCTS_EXCEL_COLUMNS,
  CATEGORIES_EXCEL_COLUMNS,
  USERS_EXCEL_COLUMNS,
  VALID_DISCOUNT_TYPES,
  VALID_DAYS,
  DISCOUNT_FEATURE_TYPES
} = require('../constants/discountConstants');
const {
  DEFAULT_DISCOUNT_TIMEZONE,
  normalizeDateKey,
  startOfDayInZone,
  endOfDayInZone,
  isDateBeforeToday
} = require('../utils/discountSchedule');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
| Validation failures are NOT thrown - they are returned via returnResult()
| so the controller can respond with sendError() outside of any catch block.
*/

const validateBasicFields = (payload) => {
  try {
    if (!payload.name || !String(payload.name).trim()) {
      return { valid: false, message: 'Discount name is required.' };
    }

    if (!VALID_DISCOUNT_TYPES.includes(payload.discountType)) {
      return { valid: false, message: `discountType must be one of ${VALID_DISCOUNT_TYPES.join(', ')}.` };
    }

    if (payload.discountValue === undefined || payload.discountValue === null || Number(payload.discountValue) < 0) {
      return { valid: false, message: 'A valid discountValue is required.' };
    }

    if (payload.discountType === 'PERCENTAGE' && Number(payload.discountValue) > 100) {
      return { valid: false, message: 'discountValue cannot exceed 100 when discountType is PERCENTAGE.' };
    }

    if (!Object.keys(GIVE_DISCOUNT_TO_CONFIG).includes(payload.giveDiscountTo)) {
      return { valid: false, message: 'A valid giveDiscountTo value is required.' };
    }

    if (payload.isDiscountReusable === true) {
      if (!payload.discountReusableNumber || Number(payload.discountReusableNumber) < 1) {
        return { valid: false, message: 'discountReusableNumber is required and must be >= 1 when isDiscountReusable is true.' };
      }
    }

    if (payload.numberOfUsersCanUseDiscount !== undefined && payload.numberOfUsersCanUseDiscount !== null) {
      if (Number(payload.numberOfUsersCanUseDiscount) < 1) {
        return { valid: false, message: 'numberOfUsersCanUseDiscount must be >= 1 when provided.' };
      }
    }

    const hasCustomerLimit = payload.numberOfUsersCanUseDiscount !== undefined && payload.numberOfUsersCanUseDiscount !== null && payload.numberOfUsersCanUseDiscount !== '';
    if (payload.firstOrderOnly === true && hasCustomerLimit) {
      return { valid: false, message: 'Use either firstOrderOnly or numberOfUsersCanUseDiscount, not both.' };
    }

    if (payload.isDiscountBasedOnPaymentMethods === true) {
      if (!Array.isArray(payload.discountOnPaymentMethods) || payload.discountOnPaymentMethods.length === 0) {
        return { valid: false, message: 'discountOnPaymentMethods is required when isDiscountBasedOnPaymentMethods is true.' };
      }
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const validateDiscountTimingFlow = (payload, options = {}) => {
  try {
    const { isUpdate = false, existingStartDate = null, existingEndDate = null, existingTimezone = null } = options;

    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;
    const isCoupon = payload.isCouponCodeDiscount === true;
    const timezone = payload.timezone || DEFAULT_DISCOUNT_TIMEZONE;

    // Dates are whole calendar days in the discount's timezone. On update,
    // "not in the past" is only re-checked when the start day actually changes.
    const startDateChanged = !isUpdate
      || !existingStartDate
      || normalizeDateKey(payload.startDate, timezone) !== normalizeDateKey(existingStartDate, existingTimezone || timezone);
    // An already-expired discount can still be edited (e.g. renamed) as long as its end day is left alone.
    const endDateChanged = !isUpdate
      || !existingEndDate
      || normalizeDateKey(payload.endDate, timezone) !== normalizeDateKey(existingEndDate, existingTimezone || timezone);

    const checkStartDateNotInPast = () => {
      const startKey = normalizeDateKey(payload.startDate, timezone);
      const endKey = normalizeDateKey(payload.endDate, timezone);
      if (!startKey || !endKey) {
        return { valid: false, message: 'startDate and endDate must be valid dates.' };
      }
      if (endKey < startKey) {
        return { valid: false, message: 'endDate cannot be before startDate.' };
      }
      if (startDateChanged && isDateBeforeToday(startKey, timezone)) {
        return { valid: false, message: 'startDate cannot be before today.' };
      }
      if (endDateChanged && isDateBeforeToday(endKey, timezone)) {
        return { valid: false, message: 'endDate cannot be before today.' };
      }
      return { valid: true };
    };

    if (isOngoing) {
      // No start/end date required, no minQty/coupon fields required.
      return { valid: true };
    }

    if (isMinQty) {
      if (!payload.minimumQuantity || Number(payload.minimumQuantity) < 1) {
        return { valid: false, message: 'minimumQuantity is required and must be >= 1 when isMinimumDiscountQuantityDiscount is true.' };
      }
      if (!payload.startDate || !payload.endDate) {
        return { valid: false, message: 'startDate and endDate are required for a minimum-quantity discount.' };
      }
      const startDateCheck = checkStartDateNotInPast();
      if (!startDateCheck.valid) return startDateCheck;
      return { valid: true };
    }

    if (isCoupon) {
      if (!payload.couponCode || !String(payload.couponCode).trim()) {
        return { valid: false, message: 'couponCode is required when isCouponCodeDiscount is true.' };
      }
      if (!payload.startDate || !payload.endDate) {
        return { valid: false, message: 'startDate and endDate are required for a coupon-code discount.' };
      }
      const startDateCheck = checkStartDateNotInPast();
      if (!startDateCheck.valid) return startDateCheck;
      return { valid: true };
    }

    // Normal discount - neither ongoing, minQty, nor coupon.
    if (!payload.startDate || !payload.endDate) {
      return { valid: false, message: 'startDate and endDate are required for this discount.' };
    }
    const startDateCheck = checkStartDateNotInPast();
    if (!startDateCheck.valid) return startDateCheck;

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const validateSpecificDaysAndHours = (payload) => {
  try {
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;
    const isCoupon = payload.isCouponCodeDiscount === true;
    const eligibleForSpecificDays = isMinQty || isCoupon;

    if (payload.isDiscountOpenForSpecificDays === true) {
      if (!eligibleForSpecificDays) {
        return {
          valid: false,
          message: 'isDiscountOpenForSpecificDays can only be used when isMinimumDiscountQuantityDiscount or isCouponCodeDiscount is true.'
        };
      }

      if (!Array.isArray(payload.specificDays) || payload.specificDays.length === 0) {
        return { valid: false, message: 'specificDays is required when isDiscountOpenForSpecificDays is true.' };
      }

      const invalidDays = payload.specificDays.filter((d) => !VALID_DAYS.includes(d));
      if (invalidDays.length > 0) {
        return { valid: false, message: `Invalid day(s) in specificDays: ${invalidDays.join(', ')}` };
      }

      if (payload.isDiscountOpenForSpecificHours === true) {
        if (!payload.specificHoursStartTime || !payload.specificHoursEndTime) {
          return { valid: false, message: 'specificHoursStartTime and specificHoursEndTime are required when isDiscountOpenForSpecificHours is true.' };
        }
      }
      if (payload.isDiscountOpenForSpecificHours === true && payload.specificHoursStartTime === payload.specificHoursEndTime) {
        return { valid: false, message: 'specificHoursStartTime and specificHoursEndTime cannot be the same.' };
      }
    } else if (payload.isDiscountOpenForSpecificHours === true) {
      return { valid: false, message: 'isDiscountOpenForSpecificHours requires isDiscountOpenForSpecificDays to be true.' };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| COMPANY-MASTER PERMISSION CHECKS
|--------------------------------------------------------------------------
| Empty/unset restriction arrays on companyMaster mean "everything allowed" -
| this is the backward-compatible default for vendors who haven't been
| configured yet.
*/

const validateGiveDiscountToAllowed = (payload, companyMasterData) => {
  try {
    const allowed = (companyMasterData && Array.isArray(companyMasterData.allowedConstantsOfGiveDiscountTo))
      ? companyMasterData.allowedConstantsOfGiveDiscountTo
      : [];

    if (allowed.length === 0) {
      return { valid: true };
    }

    if (!allowed.includes(payload.giveDiscountTo)) {
      return { valid: false, message: `giveDiscountTo "${payload.giveDiscountTo}" is not enabled for this vendor.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const validateDiscountTypeAllowed = (payload, companyMasterData) => {
  try {
    const allowed = (companyMasterData && Array.isArray(companyMasterData.allowedDiscountTypes))
      ? companyMasterData.allowedDiscountTypes
      : [];

    if (allowed.length === 0) {
      return { valid: true };
    }

    if (!allowed.includes(payload.discountType)) {
      return { valid: false, message: `discountType "${payload.discountType}" is not enabled for this vendor.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

// Derives which DISCOUNT_FEATURE_TYPES the payload is actually requesting.
// The primary type (Ongoing / MinQty / Coupon / Scheduled) is mutually
// exclusive; Specific-Days(+Hours) and Payment-Method are additive on top.
const resolveRequestedDiscountFeatureTypes = (payload) => {
  try {
    const requested = [];

    if (payload.isOngoingDiscount === true) {
      requested.push(DISCOUNT_FEATURE_TYPES.ONGOING_DISCOUNT);
    } else if (payload.isMinimumDiscountQuantityDiscount === true) {
      requested.push(DISCOUNT_FEATURE_TYPES.MINIMUM_QUANTITY_DISCOUNT);
    } else if (payload.isCouponCodeDiscount === true) {
      requested.push(DISCOUNT_FEATURE_TYPES.COUPON_CODE_DISCOUNT);
    } else {
      requested.push(DISCOUNT_FEATURE_TYPES.SCHEDULED_DISCOUNT);
    }

    if (payload.isDiscountOpenForSpecificDays === true) {
      requested.push(
        payload.isDiscountOpenForSpecificHours === true
          ? DISCOUNT_FEATURE_TYPES.SPECIFIC_DAYS_HOURS_DISCOUNT
          : DISCOUNT_FEATURE_TYPES.SPECIFIC_DAYS_DISCOUNT
      );
    }

    if (payload.isDiscountBasedOnPaymentMethods === true) {
      requested.push(DISCOUNT_FEATURE_TYPES.PAYMENT_METHOD_DISCOUNT);
    }

    return requested;
  } catch (err) {
    throw err;
  }
};

const validateDiscountFeatureTypesAllowed = (payload, companyMasterData) => {
  try {
    const allowed = (companyMasterData && Array.isArray(companyMasterData.allowedDiscountFeatureTypes))
      ? companyMasterData.allowedDiscountFeatureTypes
      : [];

    if (allowed.length === 0) {
      return { valid: true };
    }

    const requested = resolveRequestedDiscountFeatureTypes(payload);
    const notAllowed = requested.filter((type) => !allowed.includes(type));

    if (notAllowed.length > 0) {
      return { valid: false, message: `The following discount type(s) are not enabled for this vendor: ${notAllowed.join(', ')}.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| COUPON CODE AVAILABILITY
|--------------------------------------------------------------------------
| Uniqueness is enforced here, NOT via a DB unique index, so that a coupon
| code freed up by an expired/inactive discount can be reused. "Conflicting"
| means: same vendor, same code, status 'A', and not yet expired
| (endDate null OR endDate >= now). Excludes the discount being updated so
| a discount doesn't collide with itself.
*/

const checkCouponCodeAvailability = async (vendorId, couponCode, excludeDiscountId = null) => {
  try {
    const now = new Date();
    const normalizedCode = String(couponCode).trim().toUpperCase();

    const query = {
      vendorId,
      couponCode: normalizedCode,
      status: 'A',
      $or: [
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    };

    if (excludeDiscountId) {
      query._id = { $ne: excludeDiscountId };
    }

    const conflict = await Discount.findOne(query);

    if (conflict) {
      return { valid: false, message: `Coupon code "${normalizedCode}" is already in use by an active discount.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| GIVE-DISCOUNT-TO RESOLUTION
|--------------------------------------------------------------------------   
| Resolves excel uploads / dropdown-selected group ids into the actual
| productIds / categoryIds / userIds / *GroupIds arrays stored on Discount.
*/

const validateObjectIdArray = (ids, fieldLabel) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { valid: false, message: `${fieldLabel} is required and must be a non-empty array.` };
    }
    const invalid = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalid.length > 0) {
      return { valid: false, message: `${fieldLabel} contains invalid ObjectId value(s): ${invalid.join(', ')}` };
    }
    return { valid: true };
  } catch (err) {
    throw err;
  }
};

// Every selected group must exist for this vendor and be of the type the
// targeting option needs (PRODUCT / CATEGORY / USER) - otherwise the
// discount could be saved but never match anything in a cart. A newly
// selected group must also be active (the cart ignores inactive groups); one
// the discount already had (existingGroupIds) may stay after being deactivated.
const validateGroupIds = async (vendorId, groupIds, groupType, fieldLabel, existingGroupIds = []) => {
  try {
    const check = validateObjectIdArray(groupIds, fieldLabel);
    if (!check.valid) return check;

    const groups = await Group.find({ _id: { $in: groupIds }, vendorId, status: { $ne: 'D' } }, { groupName: 1, groupType: 1, status: 1 });
    const foundIds = new Set(groups.map((g) => g._id.toString()));
    if (groupIds.some((id) => !foundIds.has(id.toString()))) {
      return { valid: false, message: `One or more of the selected ${fieldLabel} were not found.` };
    }

    const wrongType = groups.filter((g) => g.groupType !== groupType);
    if (wrongType.length > 0) {
      return { valid: false, message: `These groups are not ${groupType} groups: ${wrongType.map((g) => g.groupName).join(', ')}` };
    }

    const existing = new Set((existingGroupIds || []).map((id) => id.toString()));
    const newlyInactive = groups.filter((g) => g.status !== 'A' && !existing.has(g._id.toString()));
    if (newlyInactive.length > 0) {
      return { valid: false, message: `These groups are inactive - activate them first: ${newlyInactive.map((g) => g.groupName).join(', ')}` };
    }
    return { valid: true };
  } catch (err) {
    throw err;
  }
};

// Reads one targeting sheet ("Products" / "Categories" / "Users") of the
// uploaded excel. Anything wrong with the file itself (not an .xlsx, sheet or
// column missing, no data rows) comes back as { valid: false, message } for a
// 400 - never thrown, so the admin gets a message instead of the error page.
const readTargetSheet = async (excelFile, columns, sheetName) => {
  try {
    const columnList = columns.map((c) => `"${c.header}"`).join(', ');
    const parsed = await safeParseExcelSheet(excelFile.buffer, columns, { sheetName });
    if (!parsed.ok) {
      return { valid: false, message: parsed.message };
    }

    const { rows } = parsed;
    if (rows.length === 0) {
      return { valid: false, message: `The "${sheetName}" sheet has no rows. Add them below the ${columnList} heading in row 1.` };
    }
    return { valid: true, rows };
  } catch (err) {
    throw err;
  }
};

/**
 * @param {Object} payload - discount body fields (may include productGroupIds, categoryGroupIds, userGroupIds as arrays)
 * @param {Object} files - req.files from multer .fields([{ name: 'excelFile' }])
 * @param {Object} [existingDiscount] - on update: when no new excel is uploaded and
 *   giveDiscountTo is unchanged, the products/categories/users it already
 *   targets are kept, so editing e.g. only the name never needs a re-upload.
 * @returns {Promise<{ valid: Boolean, message?: String, resolved: Object }>}
 */
const resolveGiveDiscountToTargets = async (vendorId, payload, files = {}, existingDiscount = null) => {
  try {
    const config = GIVE_DISCOUNT_TO_CONFIG[payload.giveDiscountTo];

    if (!config) {
      return { valid: false, message: 'A valid giveDiscountTo value is required.' };
    }

    if (config.notSupported) {
      return {
        valid: false,
        message: `giveDiscountTo value "${payload.giveDiscountTo}" is not supported yet (variant support is pending).`
      };
    }

    const resolved = {
      productIds: [],
      categoryIds: [],
      userIds: [],
      productGroupIds: [],
      categoryGroupIds: [],
      userGroupIds: []
    };

    const excelReports = {};
    const excelFile = files.excelFile && files.excelFile[0];

    const needsExcel = config.needsProductsFile || config.needsCategoriesFile || config.needsUsersFile;
    const keepExistingTargets = needsExcel && !excelFile && existingDiscount
      && existingDiscount.giveDiscountTo === payload.giveDiscountTo;

    if (keepExistingTargets) {
      const idStrings = (ids) => (ids || []).map((id) => id.toString());
      if (config.needsProductsFile) resolved.productIds = idStrings(existingDiscount.productIds);
      if (config.needsCategoriesFile) resolved.categoryIds = idStrings(existingDiscount.categoryIds);
      if (config.needsUsersFile) resolved.userIds = idStrings(existingDiscount.userIds);
      const missing = (config.needsProductsFile && resolved.productIds.length === 0)
        || (config.needsCategoriesFile && resolved.categoryIds.length === 0)
        || (config.needsUsersFile && resolved.userIds.length === 0);
      if (missing) {
        return { valid: false, message: 'excelFile is required for this giveDiscountTo option.' };
      }
    } else if (needsExcel && !excelFile) {
      return { valid: false, message: 'excelFile is required for this giveDiscountTo option.' };
    }

    if (config.needsProductsFile && !keepExistingTargets) {
      const sheet = await readTargetSheet(excelFile, PRODUCTS_EXCEL_COLUMNS, 'Products');
      if (!sheet.valid) return sheet;
      const { rows } = sheet;

      const report = await processExcelRows(
        rows,
        async (row) => {
          const { error, value } = bulkProductNameRowSchema.validate(row, { abortEarly: false });
          if (error) {
            return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
          }
          const doc = await Product.findOne({
            vendorId, status: 'A',
            name: { $regex: `^${escapeRegex(value.productName.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`Product "${value.productName}" not found`] };
          }
          resolved.productIds.push(doc._id.toString());
          return { success: true };
        },
        { allowPartialSuccess: true, useTransaction: false }
      );
      excelReports.products = report;

      if (report.totalRows > 0 && report.successCount === 0) {
        return { valid: false, message: 'None of the products in the uploaded excel file could be matched.', excelReports };
      }
    }

    if (config.needsCategoriesFile && !keepExistingTargets) {
      const sheet = await readTargetSheet(excelFile, CATEGORIES_EXCEL_COLUMNS, 'Categories');
      if (!sheet.valid) return sheet;
      const { rows } = sheet;

      const report = await processExcelRows(
        rows,
        async (row) => {
          const { error, value } = bulkCategoryNameRowSchema.validate(row, { abortEarly: false });
          if (error) {
            return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
          }
          const doc = await Category.findOne({
            vendorId, status: 'A',
            categoryName: { $regex: `^${escapeRegex(value.categoryName.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`Category "${value.categoryName}" not found`] };
          }
          resolved.categoryIds.push(doc._id.toString());
          return { success: true };
        },
        { allowPartialSuccess: true, useTransaction: false }
      );
      excelReports.categories = report;

      if (report.totalRows > 0 && report.successCount === 0) {
        return { valid: false, message: 'None of the categories in the uploaded excel file could be matched.', excelReports };
      }
    }

    if (config.needsUsersFile && !keepExistingTargets) {
      const sheet = await readTargetSheet(excelFile, USERS_EXCEL_COLUMNS, 'Users');
      if (!sheet.valid) return sheet;
      const { rows } = sheet;

      const report = await processExcelRows(
        rows,
        async (row) => {
          const { error, value } = bulkUserEmailRowSchema.validate(row, { abortEarly: false });
          if (error) {
            return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
          }
          // Only this vendor's own active customers - never another store's user with the same email.
          const doc = await User.findOne({
            vendorId, role: 'user', status: 'A',
            email: { $regex: `^${escapeRegex(value.email.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`User with email "${value.email}" not found`] };
          }
          resolved.userIds.push(doc._id.toString());
          return { success: true };
        },
        { allowPartialSuccess: true, useTransaction: false }
      );
      excelReports.users = report;

      if (report.totalRows > 0 && report.successCount === 0) {
        return { valid: false, message: 'None of the users in the uploaded excel file could be matched.', excelReports };
      }
    }

    const existingGroups = (field) => (existingDiscount ? existingDiscount[field] || [] : []);

    if (config.needsProductGroupIds) {
      const check = await validateGroupIds(vendorId, payload.productGroupIds, 'PRODUCT', 'product groups', existingGroups('productGroupIds'));
      if (!check.valid) return check;
      resolved.productGroupIds = payload.productGroupIds;
    }

    if (config.needsCategoryGroupIds) {
      const check = await validateGroupIds(vendorId, payload.categoryGroupIds, 'CATEGORY', 'category groups', existingGroups('categoryGroupIds'));
      if (!check.valid) return check;
      resolved.categoryGroupIds = payload.categoryGroupIds;
    }

    if (config.needsUserGroupIds) {
      const check = await validateGroupIds(vendorId, payload.userGroupIds, 'USER', 'user groups', existingGroups('userGroupIds'));
      if (!check.valid) return check;
      resolved.userGroupIds = payload.userGroupIds;
    }

    // The same product/category/user listed twice in the excel counts once.
    ['productIds', 'categoryIds', 'userIds'].forEach((key) => {
      resolved[key] = [...new Set(resolved[key])];
    });

    return { valid: true, resolved, excelReports };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| EXCEL SAMPLE FILE
|--------------------------------------------------------------------------
| The sample for a giveDiscountTo option that is set up by excel: one file
| with exactly the sheet(s) that option reads (Products / Categories /
| Users), the same single file the form uploads.
*/

const TARGETING_SAMPLE_SHEETS = [
  { flag: 'needsProductsFile', name: 'Products', columns: PRODUCTS_EXCEL_COLUMNS },
  { flag: 'needsCategoriesFile', name: 'Categories', columns: CATEGORIES_EXCEL_COLUMNS },
  { flag: 'needsUsersFile', name: 'Users', columns: USERS_EXCEL_COLUMNS }
];

const buildTargetingSampleFile = async (giveDiscountTo) => {
  try {
    const config = GIVE_DISCOUNT_TO_CONFIG[giveDiscountTo];
    const sheets = config ? TARGETING_SAMPLE_SHEETS.filter((s) => config[s.flag]) : [];
    if (sheets.length === 0) {
      return common.returnResult(false, 400, 'This targeting option does not use an excel file.');
    }

    const buffer = await buildExcelTemplate({
      sheets: sheets.map((s) => ({
        name: s.name,
        columns: s.columns.map((c) => ({ header: c.header, width: 40 }))
      }))
    });

    const fileName = `discount-sample-${sheets.map((s) => s.name.toLowerCase()).join('-')}.xlsx`;
    return common.returnResult(true, 200, 'Sample file generated', { buffer, fileName });
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| MONTHLY LIMIT CHECK
|--------------------------------------------------------------------------
*/

const countDiscountsCreatedThisMonth = async (vendorId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const count = await Discount.countDocuments({
      vendorId,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    });

    return common.returnResult(true, 200, 'Monthly discount count fetched successfully', { count });
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| CRUD
|--------------------------------------------------------------------------
*/

// emailContext = { notifyCustomers, companyMasterData, websiteMasterData,
// companySettingsData } - notifyCustomers is the form's "Notify customers by
// email" checkbox (or the re-activate dialog's answer).
const createDiscount = async (vendorId, userId, payload, files, companyMasterData, emailContext = {}) => {
  try {
    const basicCheck = validateBasicFields(payload);
    if (!basicCheck.valid) {
      return common.returnResult(false, 400, basicCheck.message);
    }

    const timingCheck = validateDiscountTimingFlow(payload);
    if (!timingCheck.valid) {
      return common.returnResult(false, 400, timingCheck.message);
    }

    const daysHoursCheck = validateSpecificDaysAndHours(payload);
    if (!daysHoursCheck.valid) {
      return common.returnResult(false, 400, daysHoursCheck.message);
    }

    const giveDiscountToPermissionCheck = validateGiveDiscountToAllowed(payload, companyMasterData);
    if (!giveDiscountToPermissionCheck.valid) {
      return common.returnResult(false, 403, giveDiscountToPermissionCheck.message);
    }

    const discountTypePermissionCheck = validateDiscountTypeAllowed(payload, companyMasterData);
    if (!discountTypePermissionCheck.valid) {
      return common.returnResult(false, 403, discountTypePermissionCheck.message);
    }

    const featureTypePermissionCheck = validateDiscountFeatureTypesAllowed(payload, companyMasterData);
    if (!featureTypePermissionCheck.valid) {
      return common.returnResult(false, 403, featureTypePermissionCheck.message);
    }

    if (payload.isCouponCodeDiscount === true) {
      const couponAvailabilityCheck = await checkCouponCodeAvailability(vendorId, payload.couponCode);
      if (!couponAvailabilityCheck.valid) {
        return common.returnResult(false, 409, couponAvailabilityCheck.message);
      }
    }

    const resolution = await resolveGiveDiscountToTargets(vendorId, payload, files);
    if (!resolution.valid) {
      return common.returnResult(false, 400, resolution.message, { excelReports: resolution.excelReports });
    }

    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;
    const timezone = payload.timezone || DEFAULT_DISCOUNT_TIMEZONE;

    const discountDoc = new Discount({
      vendorId,
      name: payload.name,
      description: payload.description || '',
      remarks: payload.remarks || '',
      internalNotes: payload.internalNotes || '',
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      giveDiscountTo: payload.giveDiscountTo,

      productIds: resolution.resolved.productIds,
      categoryIds: resolution.resolved.categoryIds,
      userIds: resolution.resolved.userIds,
      productGroupIds: resolution.resolved.productGroupIds,
      categoryGroupIds: resolution.resolved.categoryGroupIds,
      userGroupIds: resolution.resolved.userGroupIds,

      discountValidAboveAmount: isMinQty ? 0 : (payload.discountValidAboveAmount || 0),
      isOngoingDiscount: isOngoing,
      // Whole days in the discount's timezone: 00:00 on the first, 23:59:59.999 on the last.
      startDate: isOngoing ? null : startOfDayInZone(payload.startDate, timezone),
      endDate: isOngoing ? null : endOfDayInZone(payload.endDate, timezone),

      precedence: payload.precedence || 0,
      numberOfUsersCanUseDiscount: payload.firstOrderOnly === true ? null : (payload.numberOfUsersCanUseDiscount || null),
      isMultipleDiscountUsageOn: payload.isMultipleDiscountUsageOn === true,
      isDiscountReusable: payload.isDiscountReusable === true,
      discountReusableNumber: payload.isDiscountReusable ? payload.discountReusableNumber : null,
      // A coupon discount is only ever reachable by its code.
      autoApply: payload.autoApply === true && payload.isCouponCodeDiscount !== true,

      isMinimumDiscountQuantityDiscount: isMinQty,
      minimumQuantity: isMinQty ? payload.minimumQuantity : null,

      isCouponCodeDiscount: payload.isCouponCodeDiscount === true,
      couponCode: payload.isCouponCodeDiscount ? String(payload.couponCode).trim().toUpperCase() : null,

      firstOrderOnly: payload.firstOrderOnly === true,
      isDiscountUsedForFirstTime: false, // system-managed, never accepted from payload

      isDiscountBasedOnPaymentMethods: payload.isDiscountBasedOnPaymentMethods === true,
      discountOnPaymentMethods: payload.isDiscountBasedOnPaymentMethods ? payload.discountOnPaymentMethods : [],

      isDiscountOpenForSpecificDays: payload.isDiscountOpenForSpecificDays === true,
      specificDays: payload.isDiscountOpenForSpecificDays ? payload.specificDays : [],
      isDiscountOpenForSpecificHours: payload.isDiscountOpenForSpecificHours === true,
      specificHoursStartTime: payload.isDiscountOpenForSpecificHours ? payload.specificHoursStartTime : null,
      specificHoursEndTime: payload.isDiscountOpenForSpecificHours ? payload.specificHoursEndTime : null,

      timezone,

      status: 'A',
      createdBy: userId
    });

    await discountDoc.save();

    if (emailContext.notifyCustomers && discountDoc.status === 'A') {
      promotionEmailService.notifyDiscountAvailable({ vendorId, discount: discountDoc, ...emailContext, userId });
    }

    logger.logInfo(1, 0, 'Discount created successfully', { vendorId, discountId: discountDoc._id });

    return common.returnResult(true, 201, 'Discount created successfully', { data: discountDoc, excelReports: resolution.excelReports });
  } catch (err) {
    throw err;
  }
};

// emailContext = { notifyCustomers, companyMasterData, websiteMasterData,
// companySettingsData } - notifyCustomers is the form's "Notify customers by
// email" checkbox (or the re-activate dialog's answer).
const updateDiscount = async (vendorId, discountId, userId, payload, files, companyMasterData, emailContext = {}) => {
  try {
    const idCheck = common.validateObjectId(discountId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const existingDiscount = await Discount.findOne({ _id: discountId, vendorId, status: { $ne: 'D' } });
    if (!existingDiscount) {
      return common.returnResult(false, 404, 'Discount not found.');
    }

    const basicCheck = validateBasicFields(payload);
    if (!basicCheck.valid) {
      return common.returnResult(false, 400, basicCheck.message);
    }

    const timingCheck = validateDiscountTimingFlow(payload, {
      isUpdate: true,
      existingStartDate: existingDiscount.startDate,
      existingEndDate: existingDiscount.endDate,
      existingTimezone: existingDiscount.timezone
    });
    if (!timingCheck.valid) {
      return common.returnResult(false, 400, timingCheck.message);
    }

    const daysHoursCheck = validateSpecificDaysAndHours(payload);
    if (!daysHoursCheck.valid) {
      return common.returnResult(false, 400, daysHoursCheck.message);
    }

    const giveDiscountToPermissionCheck = validateGiveDiscountToAllowed(payload, companyMasterData);
    if (!giveDiscountToPermissionCheck.valid) {
      return common.returnResult(false, 403, giveDiscountToPermissionCheck.message);
    }

    const discountTypePermissionCheck = validateDiscountTypeAllowed(payload, companyMasterData);
    if (!discountTypePermissionCheck.valid) {
      return common.returnResult(false, 403, discountTypePermissionCheck.message);
    }

    const featureTypePermissionCheck = validateDiscountFeatureTypesAllowed(payload, companyMasterData);
    if (!featureTypePermissionCheck.valid) {
      return common.returnResult(false, 403, featureTypePermissionCheck.message);
    }

    // Only a discount that stays/becomes active can clash with another active one's code.
    const willBeActive = (payload.status || existingDiscount.status) === 'A';
    if (payload.isCouponCodeDiscount === true && willBeActive) {
      const couponAvailabilityCheck = await checkCouponCodeAvailability(vendorId, payload.couponCode, discountId);
      if (!couponAvailabilityCheck.valid) {
        return common.returnResult(false, 409, couponAvailabilityCheck.message);
      }
    }

    const resolution = await resolveGiveDiscountToTargets(vendorId, payload, files, existingDiscount);
    if (!resolution.valid) {
      return common.returnResult(false, 400, resolution.message, { excelReports: resolution.excelReports });
    }

    // Captured before the edit, for the "Discount Available" email: a
    // re-activated discount goes to everyone it's for, an active one only to
    // the customers this edit adds.
    const previousStatus = existingDiscount.status;
    const previousTargetUserIds = await promotionEmailService.resolveDiscountTargetUserIds(vendorId, existingDiscount);
    const previousEndDate = existingDiscount.endDate ? new Date(existingDiscount.endDate).getTime() : null;

    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;
    const timezone = payload.timezone || existingDiscount.timezone || DEFAULT_DISCOUNT_TIMEZONE;

    existingDiscount.name = payload.name;
    existingDiscount.description = payload.description || '';
    existingDiscount.remarks = payload.remarks || '';
    existingDiscount.internalNotes = payload.internalNotes || '';
    existingDiscount.discountType = payload.discountType;
    existingDiscount.discountValue = payload.discountValue;
    existingDiscount.giveDiscountTo = payload.giveDiscountTo;

    existingDiscount.productIds = resolution.resolved.productIds;
    existingDiscount.categoryIds = resolution.resolved.categoryIds;
    existingDiscount.userIds = resolution.resolved.userIds;
    existingDiscount.productGroupIds = resolution.resolved.productGroupIds;
    existingDiscount.categoryGroupIds = resolution.resolved.categoryGroupIds;
    existingDiscount.userGroupIds = resolution.resolved.userGroupIds;

    existingDiscount.discountValidAboveAmount = isMinQty ? 0 : (payload.discountValidAboveAmount || 0);
    existingDiscount.isOngoingDiscount = isOngoing;
    existingDiscount.startDate = isOngoing ? null : startOfDayInZone(payload.startDate, timezone);
    existingDiscount.endDate = isOngoing ? null : endOfDayInZone(payload.endDate, timezone);

    existingDiscount.precedence = payload.precedence || 0;
    existingDiscount.numberOfUsersCanUseDiscount = payload.firstOrderOnly === true ? null : (payload.numberOfUsersCanUseDiscount || null);
    existingDiscount.isMultipleDiscountUsageOn = payload.isMultipleDiscountUsageOn === true;
    existingDiscount.isDiscountReusable = payload.isDiscountReusable === true;
    existingDiscount.discountReusableNumber = payload.isDiscountReusable ? payload.discountReusableNumber : null;
    existingDiscount.autoApply = payload.autoApply === true && payload.isCouponCodeDiscount !== true;

    existingDiscount.isMinimumDiscountQuantityDiscount = isMinQty;
    existingDiscount.minimumQuantity = isMinQty ? payload.minimumQuantity : null;

    existingDiscount.isCouponCodeDiscount = payload.isCouponCodeDiscount === true;
    existingDiscount.couponCode = payload.isCouponCodeDiscount ? String(payload.couponCode).trim().toUpperCase() : null;

    existingDiscount.firstOrderOnly = payload.firstOrderOnly === true;
    // isDiscountUsedForFirstTime intentionally NOT updatable here - system-managed at order time.

    existingDiscount.isDiscountBasedOnPaymentMethods = payload.isDiscountBasedOnPaymentMethods === true;
    existingDiscount.discountOnPaymentMethods = payload.isDiscountBasedOnPaymentMethods ? payload.discountOnPaymentMethods : [];

    existingDiscount.isDiscountOpenForSpecificDays = payload.isDiscountOpenForSpecificDays === true;
    existingDiscount.specificDays = payload.isDiscountOpenForSpecificDays ? payload.specificDays : [];
    existingDiscount.isDiscountOpenForSpecificHours = payload.isDiscountOpenForSpecificHours === true;
    existingDiscount.specificHoursStartTime = payload.isDiscountOpenForSpecificHours ? payload.specificHoursStartTime : null;
    existingDiscount.specificHoursEndTime = payload.isDiscountOpenForSpecificHours ? payload.specificHoursEndTime : null;

    existingDiscount.timezone = timezone;

    // Status transition bookkeeping - only if caller explicitly changed status.
    if (payload.status && payload.status !== existingDiscount.status && ['A', 'I'].includes(payload.status)) {
      if (payload.status === 'A') {
        existingDiscount.activeMarkedBy = userId;
        existingDiscount.activeMarkedDate = new Date();
      } else if (payload.status === 'I') {
        existingDiscount.inActiveMarkedBy = userId;
        existingDiscount.inActiveMarkedDate = new Date();
      }
      existingDiscount.status = payload.status;
    }

    existingDiscount.updatedBy = userId;

    // A moved end date gets its own "Expiring Soon" reminder.
    const newEndDate = existingDiscount.endDate ? new Date(existingDiscount.endDate).getTime() : null;
    if (newEndDate !== previousEndDate) {
      existingDiscount.expiryReminderSentAt = null;
    }

    await existingDiscount.save();

    if (emailContext.notifyCustomers && existingDiscount.status === 'A') {
      promotionEmailService.notifyDiscountAvailable({
        vendorId,
        discount: existingDiscount,
        previousTargetUserIds: previousStatus === 'A' ? previousTargetUserIds : null,
        ...emailContext,
        userId
      });
    }

    logger.logInfo(1, 0, 'Discount updated successfully', { vendorId, discountId });

    return common.returnResult(true, 200, 'Discount updated successfully', { data: existingDiscount, excelReports: resolution.excelReports });
  } catch (err) {
    throw err;
  }
};

// Single-discount status flip used only by the bulk endpoint below - mirrors
// the status branch inside updateDiscount, kept separate so a bulk call
// never touches any of updateDiscount's other required payload fields.
const setDiscountStatusForBulk = async (vendorId, userId, discountId, status, emailContext = {}) => {
  try {
    const discount = await Discount.findOne({ _id: discountId, vendorId, status: { $ne: 'D' } });
    if (!discount) {
      return common.returnResult(false, 404, 'Discount not found.');
    }
    const wasActive = discount.status === 'A';

    // Re-activating a coupon discount must not create a second live discount with the same code.
    if (status === 'A' && !wasActive && discount.isCouponCodeDiscount && discount.couponCode) {
      const couponAvailabilityCheck = await checkCouponCodeAvailability(vendorId, discount.couponCode, discount._id);
      if (!couponAvailabilityCheck.valid) {
        return common.returnResult(false, 409, couponAvailabilityCheck.message);
      }
    }

    if (status === 'A') {
      discount.activeMarkedBy = userId;
      discount.activeMarkedDate = new Date();
    } else {
      discount.inActiveMarkedBy = userId;
      discount.inActiveMarkedDate = new Date();
    }
    discount.status = status;
    discount.updatedBy = userId;

    await discount.save();

    if (emailContext.notifyCustomers && status === 'A' && !wasActive) {
      promotionEmailService.notifyDiscountAvailable({ vendorId, discount, ...emailContext, userId });
    }
    return common.returnResult(true, 200, `Discount ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    throw err;
  }
};

const bulkSetDiscountStatus = async (vendorId, userId, discountIds, status, emailContext = {}) => {
  try {
    const { results, successCount, failureCount } = await common.runBulkOperation(
      discountIds,
      (id) => setDiscountStatusForBulk(vendorId, userId, id, status, emailContext)
    );

    logger.logInfo(successCount, failureCount, 'Bulk discount status update completed', { vendorId, status, successCount, failureCount });

    return common.returnResult(
      true, 200,
      `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${discountIds.length} discount(s).`,
      { results, successCount, failureCount }
    );
  } catch (err) {
    throw err;
  }
};

const bulkDeleteDiscounts = async (vendorId, userId, discountIds) => {
  try {
    const { results, successCount, failureCount } = await common.runBulkOperation(
      discountIds,
      (id) => deleteDiscount(vendorId, id, userId)
    );

    logger.logInfo(successCount, failureCount, 'Bulk discount delete completed', { vendorId, successCount, failureCount });

    return common.returnResult(
      true, 200,
      `Deleted ${successCount} of ${discountIds.length} discount(s).`,
      { results, successCount, failureCount }
    );
  } catch (err) {
    throw err;
  }
};

const fetchDiscountById = async (vendorId, discountId) => {
  try {
    const idCheck = common.validateObjectId(discountId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const discount = await Discount.findOne({ _id: discountId, vendorId, status: { $ne: 'D' } });
    if (!discount) {
      return common.returnResult(false, 404, 'Discount not found.');
    }

    return common.returnResult(true, 200, 'Discount fetched successfully', { data: discount });
  } catch (err) {
    throw err;
  }
};

// Admin listing: status A or I (never D), sorted by most recently created first.
const fetchDiscountsForAdmin = async (vendorId) => {
  try {
    const discounts = await Discount.find({
      vendorId,
      status: { $in: ['A', 'I'] }
    }).sort({ createdAt: -1 });

    return common.returnResult(true, 200, 'Discounts fetched successfully', { data: discounts });
  } catch (err) {
    throw err;
  }
};

// Storefront listing (logged-in customers only): the active discounts this
// customer could be offered - never a coupon discount (reachable only by its
// code) and never one aimed at other customers. The controller strips each
// one down to its public fields (no user lists, codes or internal notes).
const fetchActiveDiscountsForUser = async (vendorId, userId) => {
  try {
    const now = new Date();
    const userGroupIds = await Group.find({ vendorId, groupType: 'USER', status: 'A', members: userId }).distinct('_id');

    const discounts = await Discount.find({
      vendorId,
      status: 'A',
      isDiscountForceClosed: { $ne: true },
      isCouponCodeDiscount: { $ne: true },
      isDiscountBasedOnPaymentMethods: { $ne: true },
      $and: [
        { $or: [{ isOngoingDiscount: true }, { endDate: null }, { endDate: { $gte: now } }] },
        { $or: [{ isOngoingDiscount: true }, { startDate: null }, { startDate: { $lte: now } }] },
        {
          $or: [
            { giveDiscountTo: { $nin: ['USER_GROUP', 'ALL_PRODUCTS_SPECIFIC_USERS', 'SPECIFIC_PRODUCTS_SPECIFIC_USERS', 'SPECIFIC_CATEGORIES_SPECIFIC_USERS', 'CATEGORY_GROUP_SPECIFIC_USERS', 'PRODUCT_GROUP_SPECIFIC_USERS', 'PRODUCT_VARIANTS_SPECIFIC_USERS'] } },
            { giveDiscountTo: { $ne: 'USER_GROUP' }, userIds: userId },
            { giveDiscountTo: 'USER_GROUP', userGroupIds: { $in: userGroupIds } }
          ]
        }
      ]
    }).sort({ precedence: -1 });

    return common.returnResult(true, 200, 'Active discounts fetched successfully', { data: discounts });
  } catch (err) {
    throw err;
  }
};

// Soft delete only.
const deleteDiscount = async (vendorId, discountId, userId) => {
  try {
    const idCheck = common.validateObjectId(discountId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const discount = await Discount.findOne({ _id: discountId, vendorId, status: { $ne: 'D' } });
    if (!discount) {
      return common.returnResult(false, 404, 'Discount not found.');
    }

    discount.status = 'D';
    discount.deletedBy = userId;
    await discount.save();

    logger.logInfo(1, 0, 'Discount deleted successfully', { vendorId, discountId });

    return common.returnResult(true, 200, 'Discount deleted successfully');
  } catch (err) {
    throw err;
  }
};

module.exports = {
  buildTargetingSampleFile,
  countDiscountsCreatedThisMonth,
  createDiscount,
  updateDiscount,
  fetchDiscountById,
  fetchDiscountsForAdmin,
  fetchActiveDiscountsForUser,
  deleteDiscount,
  bulkSetDiscountStatus,
  bulkDeleteDiscounts
};