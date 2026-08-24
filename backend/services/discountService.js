const mongoose = require('mongoose');
const Discount = require('../models/Discount');
// NOTE: these models do not exist yet in the codebase. Paths/field names are
// wired per the field names confirmed by the team (productName, categoryName, email).
// Requires will fail until these models are created - that's expected for now.
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');

const logger = require('../utils/logger');
const common = require('../utils/common');
const { parseExcelBuffer } = require('../utils/excelParser');
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
  VALID_DAYS
} = require('../constants/discountConstants');

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

const validateDiscountTimingFlow = (payload) => {
  try {
    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;
    const isCoupon = payload.isCouponCodeDiscount === true;

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
      return { valid: true };
    }

    if (isCoupon) {
      if (!payload.couponCode || !String(payload.couponCode).trim()) {
        return { valid: false, message: 'couponCode is required when isCouponCodeDiscount is true.' };
      }
      if (!payload.startDate || !payload.endDate) {
        return { valid: false, message: 'startDate and endDate are required for a coupon-code discount.' };
      }
      return { valid: true };
    }

    // Normal discount - neither ongoing, minQty, nor coupon.
    if (!payload.startDate || !payload.endDate) {
      return { valid: false, message: 'startDate and endDate are required for this discount.' };
    }

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

/**
 * @param {Object} payload - discount body fields (may include productGroupIds, categoryGroupIds, userGroupIds as arrays)
 * @param {Object} files - req.files from multer .fields([{ name: 'productsFile' }, { name: 'categoriesFile' }, { name: 'usersFile' }])
 * @returns {Promise<{ valid: Boolean, message?: String, resolved: Object }>}
 */
const resolveGiveDiscountToTargets = async (vendorId, payload, files = {}) => {
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
    if (needsExcel && !excelFile) {
      return { valid: false, message: 'excelFile is required for this giveDiscountTo option.' };
    }

    if (config.needsProductsFile) {
      let rows;
      try {
        ({ rows } = await parseExcelBuffer(excelFile.buffer, PRODUCTS_EXCEL_COLUMNS, { sheetName: 'Products' }));
      } catch (err) {
        if (String(err.message).includes('was not found')) {
          return { valid: false, message: '"Products" sheet is required in the excel file for this giveDiscountTo option.' };
        }
        throw err;
      }

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

    if (config.needsCategoriesFile) {
      let rows;
      try {
        ({ rows } = await parseExcelBuffer(excelFile.buffer, CATEGORIES_EXCEL_COLUMNS, { sheetName: 'Categories' }));
      } catch (err) {
        if (String(err.message).includes('was not found')) {
          return { valid: false, message: '"Categories" sheet is required in the excel file for this giveDiscountTo option.' };
        }
        throw err;
      }

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

    if (config.needsUsersFile) {
      let rows;
      try {
        ({ rows } = await parseExcelBuffer(excelFile.buffer, USERS_EXCEL_COLUMNS, { sheetName: 'Users' }));
      } catch (err) {
        if (String(err.message).includes('was not found')) {
          return { valid: false, message: '"Users" sheet is required in the excel file for this giveDiscountTo option.' };
        }
        throw err;
      }

      const report = await processExcelRows(
        rows,
        async (row) => {
          const { error, value } = bulkUserEmailRowSchema.validate(row, { abortEarly: false });
          if (error) {
            return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
          }
          const doc = await User.findOne({
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

    if (config.needsProductGroupIds) {
      const check = validateObjectIdArray(payload.productGroupIds, 'productGroupIds');
      if (!check.valid) return check;
      resolved.productGroupIds = payload.productGroupIds;
    }

    if (config.needsCategoryGroupIds) {
      const check = validateObjectIdArray(payload.categoryGroupIds, 'categoryGroupIds');
      if (!check.valid) return check;
      resolved.categoryGroupIds = payload.categoryGroupIds;
    }

    if (config.needsUserGroupIds) {
      const check = validateObjectIdArray(payload.userGroupIds, 'userGroupIds');
      if (!check.valid) return check;
      resolved.userGroupIds = payload.userGroupIds;
    }

    return { valid: true, resolved, excelReports };
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

const createDiscount = async (vendorId, userId, payload, files) => {
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

        const resolution = await resolveGiveDiscountToTargets(vendorId, payload, files);
    if (!resolution.valid) {
      return common.returnResult(false, 400, resolution.message, { notFoundSummary: resolution.notFoundSummary });
    }

    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;

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
      startDate: isOngoing ? null : payload.startDate,
      endDate: isOngoing ? null : payload.endDate,

      precedence: payload.precedence || 0,
      numberOfUsersCanUseDiscount: payload.numberOfUsersCanUseDiscount || null,
      isMultipleDiscountUsageOn: payload.isMultipleDiscountUsageOn === true,
      isDiscountReusable: payload.isDiscountReusable === true,
      discountReusableNumber: payload.isDiscountReusable ? payload.discountReusableNumber : null,
      autoApply: payload.autoApply === true,

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

      timezone: payload.timezone || 'Asia/Kolkata',

      status: 'A',
      createdBy: userId
    });

    await discountDoc.save();

    logger.logInfo(1, 0, 'Discount created successfully', { vendorId, discountId: discountDoc._id });

    return common.returnResult(true, 201, 'Discount created successfully', { data: discountDoc, excelReports: resolution.excelReports });
  } catch (err) {
    throw err;
  }
};

const updateDiscount = async (vendorId, discountId, userId, payload, files) => {
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

    const timingCheck = validateDiscountTimingFlow(payload);
    if (!timingCheck.valid) {
      return common.returnResult(false, 400, timingCheck.message);
    }

    const daysHoursCheck = validateSpecificDaysAndHours(payload);
    if (!daysHoursCheck.valid) {
      return common.returnResult(false, 400, daysHoursCheck.message);
    }

    const resolution = await resolveGiveDiscountToTargets(vendorId, payload, files);
    if (!resolution.valid) {
      return common.returnResult(false, 400, resolution.message, { excelReports: resolution.excelReports });
    }

    const isOngoing = payload.isOngoingDiscount === true;
    const isMinQty = payload.isMinimumDiscountQuantityDiscount === true;

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
    existingDiscount.startDate = isOngoing ? null : payload.startDate;
    existingDiscount.endDate = isOngoing ? null : payload.endDate;

    existingDiscount.precedence = payload.precedence || 0;
    existingDiscount.numberOfUsersCanUseDiscount = payload.numberOfUsersCanUseDiscount || null;
    existingDiscount.isMultipleDiscountUsageOn = payload.isMultipleDiscountUsageOn === true;
    existingDiscount.isDiscountReusable = payload.isDiscountReusable === true;
    existingDiscount.discountReusableNumber = payload.isDiscountReusable ? payload.discountReusableNumber : null;
    existingDiscount.autoApply = payload.autoApply === true;

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

    existingDiscount.timezone = payload.timezone || existingDiscount.timezone;

    // Status transition bookkeeping - only if caller explicitly changed status.
    if (payload.status && payload.status !== existingDiscount.status && ['A', 'I'].includes(payload.status)) {
      if (payload.status === 'A') {
        existingDiscount.activeMarkedBy = userId;
        existingDiscount.activeMarkedDate = new Date();
      } else if (payload.status === 'I') {
        existingDiscount.inActiveMarkeddBy = userId;
        existingDiscount.inactiveMarkedDate = new Date();
      }
      existingDiscount.status = payload.status;
    }

    existingDiscount.updatedBy = userId;

    await existingDiscount.save();

    logger.logInfo(1, 0, 'Discount updated successfully', { vendorId, discountId });

        return common.returnResult(true, 200, 'Discount updated successfully', { data: existingDiscount, excelReports: resolution.excelReports });
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

// User-facing (storefront) listing: only active discounts whose endDate hasn't passed,
// sorted by precedence (highest first).
const fetchActiveDiscountsForUser = async (vendorId) => {
  try {
    const now = new Date();

    const discounts = await Discount.find({
      vendorId,
      status: 'A',
      isDiscountForceClosed: false,
      $or: [
        { endDate: null },
        { endDate: { $gte: now } }
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
  countDiscountsCreatedThisMonth,
  createDiscount,
  updateDiscount,
  fetchDiscountById,
  fetchDiscountsForAdmin,
  fetchActiveDiscountsForUser,
  deleteDiscount
};