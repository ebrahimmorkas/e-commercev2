const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const User = require('../models/User');
const Category = require('../models/Category');
const Group = require('../models/Group');

const logger = require('../utils/logger');
const common = require('../utils/common');
const { parseExcelBuffer } = require('../utils/excelParser');
const { processExcelRows } = require('../utils/excelRowProcessor');
const { bulkUserEmailRowSchema } = require('../middlewares/validations/freeCashValidations');
const { GIVE_FREE_CASH_TO_CONFIG, USERS_EXCEL_COLUMNS } = require('../constants/freeCashConstants');

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
    if (!payload.freeCashName || !String(payload.freeCashName).trim()) {
      return { valid: false, message: 'Free Cash name is required.' };
    }

    if (payload.freeCashAmount === undefined || payload.freeCashAmount === null || Number(payload.freeCashAmount) < 0) {
      return { valid: false, message: 'A valid freeCashAmount is required.' };
    }

    if (!Object.keys(GIVE_FREE_CASH_TO_CONFIG).includes(payload.giveFreeCashTo)) {
      return { valid: false, message: 'A valid giveFreeCashTo value is required.' };
    }

    if (payload.maxCashUsagePerOrder !== undefined && payload.maxCashUsagePerOrder !== null) {
      if (Number(payload.maxCashUsagePerOrder) < 0) {
        return { valid: false, message: 'maxCashUsagePerOrder must be >= 0 when provided.' };
      }
      if (Number(payload.maxCashUsagePerOrder) > Number(payload.freeCashAmount)) {
        return { valid: false, message: 'maxCashUsagePerOrder cannot exceed freeCashAmount.' };
      }
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const isStartDateInThePast = (startDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start < today;
};

const validateDateFlow = (payload, options = {}) => {
  try {
    const { isUpdate = false, existingStartDate = null, existingEndDate = null } = options;

    const effectiveStartDate = payload.startDate !== undefined ? payload.startDate : existingStartDate;
    const effectiveEndDate = payload.endDate !== undefined ? payload.endDate : existingEndDate;

    if (!effectiveStartDate || !effectiveEndDate) {
      return { valid: false, message: 'startDate and endDate are required.' };
    }

    if (new Date(effectiveEndDate) <= new Date(effectiveStartDate)) {
      return { valid: false, message: 'endDate must be after startDate.' };
    }

    const startDateChanged = !isUpdate
      || payload.startDate === undefined
      || !existingStartDate
      || new Date(payload.startDate).getTime() !== new Date(existingStartDate).getTime();

    if (startDateChanged && payload.startDate !== undefined && isStartDateInThePast(payload.startDate)) {
      return { valid: false, message: 'startDate cannot be before today.' };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

// Maps each giveFreeCashTo option to the websiteMaster/companyMaster
// boolean flag(s) that must both be true for it to be usable - checked in
// addition to companyMaster.freeCashOptions below.
const FREE_CASH_PERMISSION_FLAG_MAP = {
  ALL_USERS: ['isFreeCashGivingToAllUsersFunctionalityAllowed'],
  SPECIFIC_USERS: ['isFreeCashGivingToSpecificUsersAllowed'],
  GROUPS: ['isFreeCashGivingToGroupsAllowed'],
  ONLY_MAIN_CATEGORY: ['isFreeCashGivingToSpecificCategoryAllowed'],
  MAIN_CATEGORY_AND_SUB_CATEGORY: ['isFreeCashGivingToSpecificCategoryAllowed', 'isFreeCashGivingToNestedSubCategoryAllowed']
};

const validateGiveFreeCashToPermissions = (payload, companyMasterData, websiteMasterData) => {
  try {
    const flags = FREE_CASH_PERMISSION_FLAG_MAP[payload.giveFreeCashTo] || [];

    for (const flag of flags) {
      if (!websiteMasterData || websiteMasterData[flag] !== true) {
        return {
          valid: false,
          message: (websiteMasterData && websiteMasterData.temporaryFeatureOffMessage)
            || `giveFreeCashTo "${payload.giveFreeCashTo}" is temporarily unavailable.`
        };
      }
      if (!companyMasterData || companyMasterData[flag] !== true) {
        return {
          valid: false,
          message: (websiteMasterData && websiteMasterData.featureDisabledForVendorMessage)
            || `giveFreeCashTo "${payload.giveFreeCashTo}" is not enabled for this vendor.`
        };
      }
    }

    // Empty freeCashOptions = all allowed, same convention as
    // companyMaster.allowedConstantsOfGiveDiscountTo.
    const allowedOptions = (companyMasterData && Array.isArray(companyMasterData.freeCashOptions))
      ? companyMasterData.freeCashOptions
      : [];

    if (allowedOptions.length > 0 && !allowedOptions.includes(payload.giveFreeCashTo)) {
      return { valid: false, message: `giveFreeCashTo "${payload.giveFreeCashTo}" is not enabled for this vendor.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const validateObjectIdArray = (ids, fieldLabel) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { valid: false, message: `${fieldLabel} is required and must be a non-empty array.` };
    }
    const invalid = ids.filter((id) => !common.validateObjectId(id).valid);
    if (invalid.length > 0) {
      return { valid: false, message: `${fieldLabel} contains invalid ObjectId value(s): ${invalid.join(', ')}` };
    }
    return { valid: true };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| GIVE-FREE-CASH-TO RESOLUTION
|--------------------------------------------------------------------------
| Resolves excel uploads (SPECIFIC_USERS) / selected group ids (GROUPS) /
| selected category ids (ONLY_MAIN_CATEGORY, MAIN_CATEGORY_AND_SUB_CATEGORY)
| into the actual giveToUsers / userGroupIds / mainCategoryIds / subCategoryIds
| arrays stored on FreeCash. Mirrors resolveGiveDiscountToTargets in
| discountService.js.
*/
const resolveGiveFreeCashToTargets = async (vendorId, payload, files = {}) => {
  try {
    const config = GIVE_FREE_CASH_TO_CONFIG[payload.giveFreeCashTo];
    if (!config) {
      return { valid: false, message: 'A valid giveFreeCashTo value is required.' };
    }

    const resolved = {
      giveToUsers: [],
      userGroupIds: [],
      mainCategoryIds: [],
      subCategoryIds: [],
      applicableToAllProducts: true
    };

    const excelReports = {};
    const excelFile = files.excelFile && files.excelFile[0];

    if (config.needsUsersFile) {
      if (!excelFile) {
        return { valid: false, message: 'excelFile is required for this giveFreeCashTo option.' };
      }

      let rows;
      try {
        ({ rows } = await parseExcelBuffer(excelFile.buffer, USERS_EXCEL_COLUMNS, { sheetName: 'Users' }));
      } catch (err) {
        if (String(err.message).includes('was not found')) {
          return { valid: false, message: '"Users" sheet is required in the excel file for this giveFreeCashTo option.' };
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
            vendorId,
            email: { $regex: `^${escapeRegex(value.email.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`User with email "${value.email}" not found`] };
          }
          resolved.giveToUsers.push(doc._id.toString());
          return { success: true };
        },
        { allowPartialSuccess: true, useTransaction: false }
      );
      excelReports.users = report;

      if (report.totalRows > 0 && report.successCount === 0) {
        return { valid: false, message: 'None of the users in the uploaded excel file could be matched.', excelReports };
      }
    }

    if (config.needsUserGroupIds) {
      const check = validateObjectIdArray(payload.userGroupIds, 'userGroupIds');
      if (!check.valid) return check;

      const groups = await Group.find({ _id: { $in: payload.userGroupIds }, vendorId, status: { $ne: 'D' } });
      const foundIds = new Set(groups.map((g) => g._id.toString()));
      const missing = payload.userGroupIds.filter((id) => !foundIds.has(id.toString()));
      if (missing.length > 0) {
        return { valid: false, message: `One or more user groups not found: ${missing.join(', ')}` };
      }

      const wrongType = groups.filter((g) => g.groupType !== 'USER');
      if (wrongType.length > 0) {
        return { valid: false, message: `The following group(s) are not USER-type groups: ${wrongType.map((g) => g.groupName).join(', ')}` };
      }

      resolved.userGroupIds = payload.userGroupIds;

      const memberIds = new Set();
      groups.forEach((g) => (g.members || []).forEach((m) => memberIds.add(m.toString())));
      resolved.giveToUsers = Array.from(memberIds);

      if (resolved.giveToUsers.length === 0) {
        return { valid: false, message: 'The selected group(s) have no members.' };
      }
    }

    if (config.needsMainCategoryIds) {
      const check = validateObjectIdArray(payload.mainCategoryIds, 'mainCategoryIds');
      if (!check.valid) return check;

      const mainCategories = await Category.find({ _id: { $in: payload.mainCategoryIds }, vendorId, status: { $ne: 'D' } });
      const foundIds = new Set(mainCategories.map((c) => c._id.toString()));
      const missing = payload.mainCategoryIds.filter((id) => !foundIds.has(id.toString()));
      if (missing.length > 0) {
        return { valid: false, message: `One or more main categories not found: ${missing.join(', ')}` };
      }

      const notMain = mainCategories.filter((c) => c.parent_category_id);
      if (notMain.length > 0) {
        return { valid: false, message: `The following categor(y/ies) are not main categories: ${notMain.map((c) => c.categoryName).join(', ')}` };
      }

      resolved.mainCategoryIds = payload.mainCategoryIds;
      resolved.applicableToAllProducts = false;

      if (config.needsSubCategoryIds && Array.isArray(payload.subCategoryIds) && payload.subCategoryIds.length > 0) {
        const subCheck = validateObjectIdArray(payload.subCategoryIds, 'subCategoryIds');
        if (!subCheck.valid) return subCheck;

        const subCategories = await Category.find({ _id: { $in: payload.subCategoryIds }, vendorId, status: { $ne: 'D' } });
        const foundSubIds = new Set(subCategories.map((c) => c._id.toString()));
        const missingSub = payload.subCategoryIds.filter((id) => !foundSubIds.has(id.toString()));
        if (missingSub.length > 0) {
          return { valid: false, message: `One or more sub categories not found: ${missingSub.join(', ')}` };
        }

        const mainIdSet = new Set(payload.mainCategoryIds.map((id) => id.toString()));
        const notNested = subCategories.filter((c) => !c.parent_category_id || !mainIdSet.has(c.parent_category_id.toString()));
        if (notNested.length > 0) {
          return { valid: false, message: `The following sub categor(y/ies) do not belong to the selected main category/categories: ${notNested.map((c) => c.categoryName).join(', ')}` };
        }

        resolved.subCategoryIds = payload.subCategoryIds;
      }
      // subCategoryIds left empty here (with mainCategoryIds set) means:
      // eligible for every product under the selected main category/categories.
    }

    return { valid: true, resolved, excelReports };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| LIMIT CHECKS
|--------------------------------------------------------------------------
*/

const countFreeCashCreatedThisMonth = async (vendorId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const count = await FreeCash.countDocuments({
      vendorId,
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    });

    return common.returnResult(true, 200, 'Monthly Free Cash count fetched successfully', { count });
  } catch (err) {
    throw err;
  }
};

const countFreeCashCreatedTotal = async (vendorId) => {
  try {
    const count = await FreeCash.countDocuments({ vendorId, status: { $ne: 'D' } });
    return common.returnResult(true, 200, 'Total Free Cash count fetched successfully', { count });
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| ISSUANCE
|--------------------------------------------------------------------------
| Only SPECIFIC_USERS and GROUPS resolve to a bounded, known user list at
| creation time, so only those two eagerly fan out UserFreeCash records here.
| ALL_USERS and the category-restricted options (ONLY_MAIN_CATEGORY,
| MAIN_CATEGORY_AND_SUB_CATEGORY) are NOT user-targeted and are not fanned
| out to every user up front - the set of eligible users is unbounded/grows
| over time (new signups) and this codebase has no background job queue to
| do that safely at scale. Eligibility for those options is intended to be
| resolved lazily at cart/order time in a later pass, not here.
*/
const issueUserFreeCash = async (vendorId, freeCashDoc, targetUserIds, userId, companySettingsData) => {
  try {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return common.returnResult(true, 200, 'No specific users to issue Free Cash to for this targeting option.', { issuedCount: 0 });
    }

    const stackingAllowed = companySettingsData ? companySettingsData.isFreeCashStackingAllowed === true : false;

    if (!stackingAllowed) {
      // Stacking off: issuing a new grant immediately expires every other
      // still-active grant that user already holds for this vendor,
      // irrespective of which FreeCash campaign they came from.
      await UserFreeCash.updateMany(
        {
          vendorId,
          userId: { $in: targetUserIds },
          isCashExpired: false,
          isRevoked: false,
          status: { $ne: 'D' }
        },
        {
          $set: { isCashExpired: true, cashExpiredDate: new Date() }
        }
      );
    }

    const docsToInsert = targetUserIds.map((targetUserId) => ({
      vendorId,
      freeCashId: freeCashDoc._id,
      userId: targetUserId,
      amount: freeCashDoc.freeCashAmount,
      usedAmount: 0,
      remainingAmount: freeCashDoc.freeCashAmount,
      issuedDate: new Date(),
      isCashUsed: false,
      isCashExpired: false,
      isRevoked: false,
      cashUsageHistory: [],
      status: 'A',
      createdBy: userId
    }));

    const inserted = await UserFreeCash.insertMany(docsToInsert);

    logger.logInfo(1, 0, 'Free Cash issued to target users', { vendorId, freeCashId: freeCashDoc._id, issuedCount: inserted.length });

    return common.returnResult(true, 200, 'Free Cash issued to target users successfully', { issuedCount: inserted.length });
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| CRUD
|--------------------------------------------------------------------------
*/

const createFreeCash = async (vendorId, userId, payload, files, companyMasterData, websiteMasterData, companySettingsData) => {
  try {
    const basicCheck = validateBasicFields(payload);
    if (!basicCheck.valid) {
      return common.returnResult(false, 400, basicCheck.message);
    }

    const dateCheck = validateDateFlow(payload);
    if (!dateCheck.valid) {
      return common.returnResult(false, 400, dateCheck.message);
    }

    const permissionCheck = validateGiveFreeCashToPermissions(payload, companyMasterData, websiteMasterData);
    if (!permissionCheck.valid) {
      return common.returnResult(false, 403, permissionCheck.message);
    }

    const resolution = await resolveGiveFreeCashToTargets(vendorId, payload, files);
    if (!resolution.valid) {
      return common.returnResult(false, 400, resolution.message, { excelReports: resolution.excelReports });
    }

    const freeCashDoc = new FreeCash({
      vendorId,
      freeCashName: payload.freeCashName,
      freeCashAmount: payload.freeCashAmount,
      maxCashUsagePerOrder: (payload.maxCashUsagePerOrder === undefined || payload.maxCashUsagePerOrder === null) ? null : payload.maxCashUsagePerOrder,
      giveFreeCashTo: payload.giveFreeCashTo,

      giveToUsers: resolution.resolved.giveToUsers,
      userGroupIds: resolution.resolved.userGroupIds,
      mainCategoryIds: resolution.resolved.mainCategoryIds,
      subCategoryIds: resolution.resolved.subCategoryIds,
      applicableToAllProducts: resolution.resolved.applicableToAllProducts,

      startDate: payload.startDate,
      endDate: payload.endDate,
      validAbove: payload.validAbove || 0,
      canBeUsedWithOtherDiscounts: payload.canBeUsedWithOtherDiscounts === true,

      remarks: payload.remarks || '',
      status: 'A',
      createdBy: userId
    });

    await freeCashDoc.save();

    const issueResult = await issueUserFreeCash(vendorId, freeCashDoc, resolution.resolved.giveToUsers, userId, companySettingsData);

    logger.logInfo(1, 0, 'Free Cash created successfully', { vendorId, freeCashId: freeCashDoc._id });

    return common.returnResult(true, 201, 'Free Cash created successfully', {
      data: freeCashDoc,
      excelReports: resolution.excelReports,
      issuedCount: issueResult.meta ? issueResult.meta.issuedCount : 0
    });
  } catch (err) {
    throw err;
  }
};

// Updates the FreeCash campaign document itself. Deliberately does NOT
// automatically re-issue UserFreeCash grants for a changed target set (e.g.
// newly added group members) - that is a distinct, explicit distribute
// action to avoid silently duplicating or expiring grants. Use
// issueUserFreeCash directly (a dedicated route, in a later pass) to
// re-distribute after a targeting change.
const updateFreeCash = async (vendorId, freeCashId, userId, payload, files, companyMasterData, websiteMasterData) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const existingFreeCash = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!existingFreeCash) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    const mergedPayload = {
      freeCashName: payload.freeCashName !== undefined ? payload.freeCashName : existingFreeCash.freeCashName,
      freeCashAmount: payload.freeCashAmount !== undefined ? payload.freeCashAmount : existingFreeCash.freeCashAmount,
      maxCashUsagePerOrder: payload.maxCashUsagePerOrder !== undefined ? payload.maxCashUsagePerOrder : existingFreeCash.maxCashUsagePerOrder,
      giveFreeCashTo: payload.giveFreeCashTo !== undefined ? payload.giveFreeCashTo : existingFreeCash.giveFreeCashTo
    };

    const basicCheck = validateBasicFields(mergedPayload);
    if (!basicCheck.valid) {
      return common.returnResult(false, 400, basicCheck.message);
    }

    const dateCheck = validateDateFlow(payload, {
      isUpdate: true,
      existingStartDate: existingFreeCash.startDate,
      existingEndDate: existingFreeCash.endDate
    });
    if (!dateCheck.valid) {
      return common.returnResult(false, 400, dateCheck.message);
    }

    const permissionCheck = validateGiveFreeCashToPermissions(mergedPayload, companyMasterData, websiteMasterData);
    if (!permissionCheck.valid) {
      return common.returnResult(false, 403, permissionCheck.message);
    }

    // Re-resolve targeting only when the caller is actually touching
    // targeting-related fields - otherwise keep the existing resolved sets
    // (e.g. a plain "rename this campaign" update shouldn't require
    // re-uploading the users excel / re-sending group ids).
    const targetingFieldsTouched = payload.giveFreeCashTo !== undefined
      || payload.userGroupIds !== undefined
      || payload.mainCategoryIds !== undefined
      || payload.subCategoryIds !== undefined
      || (files && files.excelFile);

    let resolvedTargets = {
      giveToUsers: existingFreeCash.giveToUsers,
      userGroupIds: existingFreeCash.userGroupIds,
      mainCategoryIds: existingFreeCash.mainCategoryIds,
      subCategoryIds: existingFreeCash.subCategoryIds,
      applicableToAllProducts: existingFreeCash.applicableToAllProducts
    };
    let excelReports = {};

    if (targetingFieldsTouched) {
      const resolution = await resolveGiveFreeCashToTargets(vendorId, mergedPayload, files);
      if (!resolution.valid) {
        return common.returnResult(false, 400, resolution.message, { excelReports: resolution.excelReports });
      }
      resolvedTargets = resolution.resolved;
      excelReports = resolution.excelReports;
    }

    existingFreeCash.freeCashName = mergedPayload.freeCashName;
    existingFreeCash.freeCashAmount = mergedPayload.freeCashAmount;
    existingFreeCash.maxCashUsagePerOrder = (mergedPayload.maxCashUsagePerOrder === undefined || mergedPayload.maxCashUsagePerOrder === null) ? null : mergedPayload.maxCashUsagePerOrder;
    existingFreeCash.giveFreeCashTo = mergedPayload.giveFreeCashTo;

    existingFreeCash.giveToUsers = resolvedTargets.giveToUsers;
    existingFreeCash.userGroupIds = resolvedTargets.userGroupIds;
    existingFreeCash.mainCategoryIds = resolvedTargets.mainCategoryIds;
    existingFreeCash.subCategoryIds = resolvedTargets.subCategoryIds;
    existingFreeCash.applicableToAllProducts = resolvedTargets.applicableToAllProducts;

    if (payload.startDate !== undefined) existingFreeCash.startDate = payload.startDate;
    if (payload.endDate !== undefined) existingFreeCash.endDate = payload.endDate;
    if (payload.validAbove !== undefined) existingFreeCash.validAbove = payload.validAbove;
    if (payload.canBeUsedWithOtherDiscounts !== undefined) existingFreeCash.canBeUsedWithOtherDiscounts = payload.canBeUsedWithOtherDiscounts === true;
    if (payload.remarks !== undefined) existingFreeCash.remarks = payload.remarks;

    if (payload.status && payload.status !== existingFreeCash.status && ['A', 'I'].includes(payload.status)) {
      if (payload.status === 'A') {
        existingFreeCash.activeMarkedBy = userId;
        existingFreeCash.activeMarkedDate = new Date();
      } else if (payload.status === 'I') {
        existingFreeCash.inActiveMarkeddBy = userId;
        existingFreeCash.inactiveMarkedDate = new Date();
      }
      existingFreeCash.status = payload.status;
    }

    existingFreeCash.updatedBy = userId;

    await existingFreeCash.save();

    logger.logInfo(1, 0, 'Free Cash updated successfully', { vendorId, freeCashId });

    return common.returnResult(true, 200, 'Free Cash updated successfully', { data: existingFreeCash, excelReports });
  } catch (err) {
    throw err;
  }
};

const fetchFreeCashById = async (vendorId, freeCashId) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCash = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCash) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    return common.returnResult(true, 200, 'Free Cash fetched successfully', { data: freeCash });
  } catch (err) {
    throw err;
  }
};

// Admin listing: status A or I (never D), sorted by most recently created first.
const fetchAllFreeCashAdmin = async (vendorId) => {
  try {
    const freeCashList = await FreeCash.find({
      vendorId,
      status: { $in: ['A', 'I'] }
    }).sort({ createdAt: -1 });

    return common.returnResult(true, 200, 'Free Cash list fetched successfully', { data: freeCashList });
  } catch (err) {
    throw err;
  }
};

// Soft delete only.
const deleteFreeCash = async (vendorId, freeCashId, userId) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCash = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCash) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    freeCash.status = 'D';
    freeCash.deletedBy = userId;
    await freeCash.save();

    logger.logInfo(1, 0, 'Free Cash deleted successfully', { vendorId, freeCashId });

    return common.returnResult(true, 200, 'Free Cash deleted successfully');
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| REVOKE
|--------------------------------------------------------------------------
| Distinct from expiry (isCashExpired, time/stacking driven) - this is a
| direct admin action, gated by isRevokingFreeCashFunctionalityAllowed /
| isRevokingAllUsersFreeCashFunctionalityAllowed at both websiteMaster and
| companyMaster level (checked in the controller, same as the feature-on
| gate). Only blocks grants not already fully used.
*/

const revokeFreeCashForUser = async (vendorId, targetUserId, freeCashId, adminUserId) => {
  try {
    const idCheck = common.validateObjectId([targetUserId, freeCashId]);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCashDoc = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCashDoc) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    const result = await UserFreeCash.updateMany(
      { vendorId, freeCashId, userId: targetUserId, isRevoked: false, isCashUsed: false, status: { $ne: 'D' } },
      { $set: { isRevoked: true, revokedBy: adminUserId, revokedDate: new Date() } }
    );

    if (!result.matchedCount) {
      return common.returnResult(false, 404, 'No active, unused Free Cash grant found for this user.');
    }

    logger.logInfo(1, 0, 'Free Cash revoked for user', { vendorId, freeCashId, targetUserId });

    return common.returnResult(true, 200, 'Free Cash revoked for the user successfully', { revokedCount: result.modifiedCount });
  } catch (err) {
    throw err;
  }
};

const revokeFreeCashForAllUsers = async (vendorId, freeCashId, adminUserId) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCashDoc = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCashDoc) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    const result = await UserFreeCash.updateMany(
      { vendorId, freeCashId, isRevoked: false, isCashUsed: false, status: { $ne: 'D' } },
      { $set: { isRevoked: true, revokedBy: adminUserId, revokedDate: new Date() } }
    );

    logger.logInfo(1, 0, 'Free Cash revoked for all users', { vendorId, freeCashId });

    return common.returnResult(true, 200, 'Free Cash revoked for all users successfully', { revokedCount: result.modifiedCount });
  } catch (err) {
    throw err;
  }
};

module.exports = {
  countFreeCashCreatedThisMonth,
  countFreeCashCreatedTotal,
  createFreeCash,
  updateFreeCash,
  fetchFreeCashById,
  fetchAllFreeCashAdmin,
  deleteFreeCash,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers
};
