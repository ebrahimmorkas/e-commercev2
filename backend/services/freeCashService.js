const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const promotionEmailService = require('./promotionEmailService');
const User = require('../models/User');
const Category = require('../models/Category');
const Group = require('../models/Group');

const logger = require('../utils/logger');
const common = require('../utils/common');
const { safeParseExcelSheet } = require('../utils/excelParser');
const { buildExcelTemplate } = require('../utils/excelTemplateBuilder');
const { processExcelRows } = require('../utils/excelRowProcessor');
const { bulkUserEmailRowSchema } = require('../middlewares/validations/freeCashValidations');
const { GIVE_FREE_CASH_TO_CONFIG, USERS_EXCEL_COLUMNS } = require('../constants/freeCashConstants');
const {
  DEFAULT_DISCOUNT_TIMEZONE,
  normalizeDateKey,
  startOfDayInZone,
  endOfDayInZone,
  isDateBeforeToday
} = require('../utils/discountSchedule');

// The options whose customers are known up front (grants issued eagerly).
const USER_TARGETED_OPTIONS = ['SPECIFIC_USERS', 'GROUPS'];

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

    if (payload.freeCashAmount === undefined || payload.freeCashAmount === null || !(Number(payload.freeCashAmount) > 0)) {
      return { valid: false, message: 'freeCashAmount must be greater than 0.' };
    }

    if (!Object.keys(GIVE_FREE_CASH_TO_CONFIG).includes(payload.giveFreeCashTo)) {
      return { valid: false, message: 'A valid giveFreeCashTo value is required.' };
    }

    if (payload.maxCashUsagePerOrder !== undefined && payload.maxCashUsagePerOrder !== null) {
      // 0 would make every grant of this campaign unusable.
      if (!(Number(payload.maxCashUsagePerOrder) > 0)) {
        return { valid: false, message: 'maxCashUsagePerOrder must be greater than 0 when provided.' };
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

// Dates are whole calendar days in the campaign's timezone ("YYYY-MM-DD" in
// the payload; stored as 00:00 on the first day and 23:59:59.999 on the
// last). A one-day campaign (start = end) is allowed. On update, "not in the
// past" is only re-checked for a date that actually changes, so an older or
// expired campaign can still be renamed.
const validateDateFlow = (payload, options = {}) => {
  try {
    const { isUpdate = false, existingStartDate = null, existingEndDate = null, existingTimezone = null } = options;
    const timezone = payload.timezone || existingTimezone || DEFAULT_DISCOUNT_TIMEZONE;
    const storedZone = existingTimezone || timezone;

    const startKey = payload.startDate !== undefined ? normalizeDateKey(payload.startDate, timezone) : normalizeDateKey(existingStartDate, storedZone);
    const endKey = payload.endDate !== undefined ? normalizeDateKey(payload.endDate, timezone) : normalizeDateKey(existingEndDate, storedZone);

    if (!startKey || !endKey) {
      return { valid: false, message: 'startDate and endDate are required and must be valid dates.' };
    }
    if (endKey < startKey) {
      return { valid: false, message: 'endDate cannot be before startDate.' };
    }

    const startChanged = !isUpdate || !existingStartDate || startKey !== normalizeDateKey(existingStartDate, storedZone);
    const endChanged = !isUpdate || !existingEndDate || endKey !== normalizeDateKey(existingEndDate, storedZone);

    if (startChanged && isDateBeforeToday(startKey, timezone)) {
      return { valid: false, message: 'startDate cannot be before today.' };
    }
    if (endChanged && isDateBeforeToday(endKey, timezone)) {
      return { valid: false, message: 'endDate cannot be before today.' };
    }

    return { valid: true, startKey, endKey, timezone };
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
// The distinct members of these USER groups who are this store's active
// customers - an inactive/deleted account never gets Free Cash.
const resolveActiveGroupMembers = async (vendorId, groups) => {
  try {
    const memberIds = new Set();
    (groups || []).forEach((g) => (g.members || []).forEach((m) => memberIds.add(m.toString())));
    if (memberIds.size === 0) return [];
    const activeIds = await User.find({ _id: { $in: [...memberIds] }, vendorId, role: 'user', status: 'A' }).distinct('_id');
    return activeIds.map((id) => id.toString());
  } catch (err) {
    throw err;
  }
};

// existingFreeCash (on update): what was saved before - a SPECIFIC_USERS
// campaign edited without a new excel keeps its customers, and a group or
// category it already uses may stay even if it has since been deactivated.
const resolveGiveFreeCashToTargets = async (vendorId, payload, files = {}, existingFreeCash = null) => {
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
    const sameOptionAsBefore = !!existingFreeCash && existingFreeCash.giveFreeCashTo === payload.giveFreeCashTo;
    const previously = (field) => new Set((sameOptionAsBefore ? existingFreeCash[field] || [] : []).map((id) => id.toString()));

    if (config.needsUsersFile && !excelFile && sameOptionAsBefore && (existingFreeCash.giveToUsers || []).length > 0) {
      // Edited without a new excel - keep the customers it already has.
      resolved.giveToUsers = existingFreeCash.giveToUsers.map((id) => id.toString());
    } else if (config.needsUsersFile) {
      if (!excelFile) {
        return { valid: false, message: 'excelFile is required for this giveFreeCashTo option.' };
      }

      // A missing sheet/column or unreadable file is the admin's to fix - a 400, never the error page.
      const parsed = await safeParseExcelSheet(excelFile.buffer, USERS_EXCEL_COLUMNS, { sheetName: 'Users' });
      if (!parsed.ok) {
        return { valid: false, message: parsed.message };
      }
      const { rows } = parsed;
      if (rows.length === 0) {
        return { valid: false, message: 'The "Users" sheet has no rows. Add the customers\' emails below the "Email" heading in row 1.' };
      }

      const report = await processExcelRows(
        rows,
        async (row) => {
          const { error, value } = bulkUserEmailRowSchema.validate(row, { abortEarly: false });
          if (error) {
            return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
          }
          // Only this store's active customers.
          const doc = await User.findOne({
            vendorId, role: 'user', status: 'A',
            email: { $regex: `^${escapeRegex(value.email.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`Active customer with email "${value.email}" not found`] };
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
      // The same customer listed twice gets one grant.
      resolved.giveToUsers = [...new Set(resolved.giveToUsers)];
    }

    if (config.needsUserGroupIds) {
      const check = validateObjectIdArray(payload.userGroupIds, 'userGroupIds');
      if (!check.valid) return check;

      const groups = await Group.find({ _id: { $in: payload.userGroupIds }, vendorId, status: { $ne: 'D' } });
      const foundIds = new Set(groups.map((g) => g._id.toString()));
      const missing = payload.userGroupIds.filter((id) => !foundIds.has(id.toString()));
      if (missing.length > 0) {
        return { valid: false, message: 'One or more of the selected user groups were not found.' };
      }

      const wrongType = groups.filter((g) => g.groupType !== 'USER');
      if (wrongType.length > 0) {
        return { valid: false, message: `The following group(s) are not USER-type groups: ${wrongType.map((g) => g.groupName).join(', ')}` };
      }

      const keptGroups = previously('userGroupIds');
      const newlyInactive = groups.filter((g) => g.status !== 'A' && !keptGroups.has(g._id.toString()));
      if (newlyInactive.length > 0) {
        return { valid: false, message: `These groups are inactive - activate them first: ${newlyInactive.map((g) => g.groupName).join(', ')}` };
      }

      resolved.userGroupIds = payload.userGroupIds;
      resolved.giveToUsers = await resolveActiveGroupMembers(vendorId, groups.filter((g) => g.status === 'A'));

      if (resolved.giveToUsers.length === 0) {
        return { valid: false, message: 'The selected group(s) have no active customers.' };
      }
    }

    if (config.needsMainCategoryIds) {
      const check = validateObjectIdArray(payload.mainCategoryIds, 'mainCategoryIds');
      if (!check.valid) return check;

      const mainCategories = await Category.find({ _id: { $in: payload.mainCategoryIds }, vendorId, status: { $ne: 'D' } });
      const foundIds = new Set(mainCategories.map((c) => c._id.toString()));
      const missing = payload.mainCategoryIds.filter((id) => !foundIds.has(id.toString()));
      if (missing.length > 0) {
        return { valid: false, message: 'One or more of the selected main categories were not found.' };
      }

      const notMain = mainCategories.filter((c) => c.parent_category_id);
      if (notMain.length > 0) {
        return { valid: false, message: `The following categor(y/ies) are not main categories: ${notMain.map((c) => c.categoryName).join(', ')}` };
      }

      const keptMain = previously('mainCategoryIds');
      const inactiveMain = mainCategories.filter((c) => c.status !== 'A' && !keptMain.has(c._id.toString()));
      if (inactiveMain.length > 0) {
        return { valid: false, message: `These categories are inactive - activate them first: ${inactiveMain.map((c) => c.categoryName).join(', ')}` };
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

        const keptSub = previously('subCategoryIds');
        const inactiveSub = subCategories.filter((c) => c.status !== 'A' && !keptSub.has(c._id.toString()));
        if (inactiveSub.length > 0) {
          return { valid: false, message: `These sub categories are inactive - activate them first: ${inactiveSub.map((c) => c.categoryName).join(', ')}` };
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

// The sample .xlsx for SPECIFIC_USERS: just the "Users" sheet with its
// "Email" heading, the same file the form uploads.
const buildUsersSampleFile = async () => {
  try {
    const buffer = await buildExcelTemplate({
      sheets: [{ name: 'Users', columns: USERS_EXCEL_COLUMNS.map((c) => ({ header: c.header, width: 40 })) }]
    });
    return common.returnResult(true, 200, 'Sample file generated', { buffer, fileName: 'free-cash-sample-users.xlsx' });
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
// emailContext = { companyMasterData, websiteMasterData } - only passed when
// a campaign is being created, so the customers whose older Free Cash this
// replaces get the Free Cash Expired email (never for a lazy cart-time issue).
// expireOtherGrants = false is for the lazy cart-time issue: a customer just
// opening their cart must never lose Free Cash they were given directly.
const issueUserFreeCash = async (vendorId, freeCashDoc, targetUserIds, userId, companySettingsData, emailContext = null, expireOtherGrants = true) => {
  try {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return common.returnResult(true, 200, 'No specific users to issue Free Cash to for this targeting option.', { issuedCount: 0 });
    }

    // One grant per customer per campaign, ever: anyone who already has one
    // (even used up, expired or revoked) is skipped - the unique index on
    // UserFreeCash backs this up against two requests racing.
    const alreadyGranted = new Set(
      (await UserFreeCash.distinct('userId', { vendorId, freeCashId: freeCashDoc._id })).map((id) => id.toString())
    );
    targetUserIds = [...new Set(targetUserIds.map((id) => id.toString()))].filter((id) => !alreadyGranted.has(id));
    if (targetUserIds.length === 0) {
      return common.returnResult(true, 200, 'Every target customer already has this Free Cash.', { issuedCount: 0 });
    }

    const stackingAllowed = companySettingsData ? companySettingsData.isFreeCashStackingAllowed === true : false;

    if (!stackingAllowed && expireOtherGrants) {
      // Stacking off: issuing a new grant immediately expires every other
      // still-active grant that user already holds for this vendor,
      // irrespective of which FreeCash campaign they came from. Those
      // customers are told (Free Cash Expired email).
      const replacedGrants = await UserFreeCash.find({
        vendorId,
        userId: { $in: targetUserIds },
        isCashExpired: false,
        isRevoked: false,
        status: { $ne: 'D' }
      }).lean();

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

      if (emailContext) {
        promotionEmailService.notifyFreeCashExpired({
          vendorId, grants: replacedGrants, ...emailContext, companySettingsData, userId
        });
      }
    }

    // Upserts keyed on the unique (vendor, campaign, customer): a grant that
    // appeared in the meantime is left alone instead of duplicated.
    const now = new Date();
    const result = await UserFreeCash.bulkWrite(targetUserIds.map((targetUserId) => ({
      updateOne: {
        filter: { vendorId, freeCashId: freeCashDoc._id, userId: targetUserId },
        update: {
          $setOnInsert: {
            vendorId,
            freeCashId: freeCashDoc._id,
            userId: targetUserId,
            amount: freeCashDoc.freeCashAmount,
            usedAmount: 0,
            remainingAmount: freeCashDoc.freeCashAmount,
            issuedDate: now,
            isCashUsed: false,
            isCashExpired: false,
            isRevoked: false,
            cashUsageHistory: [],
            cashRefundHistory: [],
            status: 'A',
            createdBy: userId,
            createdAt: now,
            updatedAt: now
          }
        },
        upsert: true
      }
    })), { ordered: false, timestamps: false });
    const issuedCount = result.upsertedCount || 0;

    logger.logInfo(1, 0, 'Free Cash issued to target users', { vendorId, freeCashId: freeCashDoc._id, issuedCount });

    return common.returnResult(true, 200, 'Free Cash issued to target users successfully', { issuedCount });
  } catch (err) {
    throw err;
  }
};

// After an edit of a SPECIFIC_USERS / GROUPS campaign: customers newly on
// its list get it (one taken off earlier by this sync gets theirs back), and
// customers no longer on it lose whatever they haven't used yet (revoked,
// with the Free Cash Revoked email). Used amounts are never touched.
// emailContext = { companyMasterData, websiteMasterData }.
const syncTargetedGrants = async (vendorId, freeCashDoc, previousUserIds, nextUserIds, adminUserId, companySettingsData, emailContext) => {
  try {
    const previous = new Set((previousUserIds || []).map((id) => id.toString()));
    const next = new Set((nextUserIds || []).map((id) => id.toString()));
    const added = [...next].filter((id) => !previous.has(id));

    // Taken off by an earlier edit and now back on: restore that grant.
    let restoredCount = 0;
    if (added.length > 0) {
      const restored = await UserFreeCash.updateMany(
        { vendorId, freeCashId: freeCashDoc._id, userId: { $in: added }, isRevoked: true, isCashUsed: false, status: { $ne: 'D' } },
        { $set: { isRevoked: false, revokedBy: null, revokedDate: null, updatedBy: adminUserId } }
      );
      restoredCount = restored.modifiedCount || 0;
    }

    const issueResult = await issueUserFreeCash(vendorId, freeCashDoc, added, adminUserId, companySettingsData, emailContext);

    // Everyone still holding an unused balance but no longer targeted.
    const revokeFilter = {
      vendorId, freeCashId: freeCashDoc._id, userId: { $nin: [...next] }, isRevoked: false, isCashUsed: false, status: { $ne: 'D' }
    };
    const revokedGrants = await UserFreeCash.find(revokeFilter).lean();
    let revokedCount = 0;
    if (revokedGrants.length > 0) {
      const revoked = await UserFreeCash.updateMany(revokeFilter, { $set: { isRevoked: true, revokedBy: adminUserId, revokedDate: new Date() } });
      revokedCount = revoked.modifiedCount || 0;
      promotionEmailService.notifyFreeCashRevoked({ vendorId, grants: revokedGrants, ...emailContext, companySettingsData, userId: adminUserId });
    }

    return { issuedCount: (issueResult.meta ? issueResult.meta.issuedCount : 0) + restoredCount, revokedCount };
  } catch (err) {
    throw err;
  }
};

/*
|--------------------------------------------------------------------------
| CRUD
|--------------------------------------------------------------------------
*/

// notifyCustomers = the form's "Notify customers by email" checkbox.
const createFreeCash = async (vendorId, userId, payload, files, companyMasterData, websiteMasterData, companySettingsData, notifyCustomers = false) => {
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

      startDate: startOfDayInZone(dateCheck.startKey, dateCheck.timezone),
      endDate: endOfDayInZone(dateCheck.endKey, dateCheck.timezone),
      timezone: dateCheck.timezone,
      validAbove: payload.validAbove || 0,
      canBeUsedWithOtherDiscounts: payload.canBeUsedWithOtherDiscounts === true,

      remarks: payload.remarks || '',
      status: 'A',
      createdBy: userId
    });

    await freeCashDoc.save();

    const issueResult = await issueUserFreeCash(
      vendorId, freeCashDoc, resolution.resolved.giveToUsers, userId, companySettingsData, { companyMasterData, websiteMasterData }
    );

    if (notifyCustomers) {
      promotionEmailService.notifyFreeCashCredited({
        vendorId, freeCash: freeCashDoc, companyMasterData, websiteMasterData, companySettingsData, userId
      });
    }

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

// Updates the campaign. For a SPECIFIC_USERS / GROUPS campaign whose
// customer list changes, the grants follow (syncTargetedGrants): new
// customers get it, removed ones lose their unused balance. A changed
// freeCashAmount only applies to grants issued from now on - customers
// already given it keep the amount they got.
// emailContext = { notifyCustomers, companySettingsData } - a re-activated
// campaign emails its customers again when notifyCustomers is set.
const updateFreeCash = async (vendorId, freeCashId, userId, payload, files, companyMasterData, websiteMasterData, emailContext = {}) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const existingFreeCash = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!existingFreeCash) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    // '' (how a multipart form sends null) = remove the per-order limit.
    if (payload.maxCashUsagePerOrder === '') payload = { ...payload, maxCashUsagePerOrder: null };

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
      existingEndDate: existingFreeCash.endDate,
      existingTimezone: existingFreeCash.timezone
    });
    if (!dateCheck.valid) {
      return common.returnResult(false, 400, dateCheck.message);
    }

    const permissionCheck = validateGiveFreeCashToPermissions(mergedPayload, companyMasterData, websiteMasterData);
    if (!permissionCheck.valid) {
      return common.returnResult(false, 403, permissionCheck.message);
    }

    // Re-resolve targeting only when the caller is actually touching
    // targeting-related fields - otherwise keep the existing resolved sets.
    // A SPECIFIC_USERS campaign re-saved without a new excel keeps its
    // customers (resolveGiveFreeCashToTargets, given the existing campaign).
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
    const previousTargetUsers = (existingFreeCash.giveToUsers || []).map((id) => id.toString());

    if (targetingFieldsTouched) {
      const resolution = await resolveGiveFreeCashToTargets(vendorId, {
        ...mergedPayload,
        userGroupIds: payload.userGroupIds !== undefined ? payload.userGroupIds : existingFreeCash.userGroupIds,
        mainCategoryIds: payload.mainCategoryIds !== undefined ? payload.mainCategoryIds : existingFreeCash.mainCategoryIds,
        subCategoryIds: payload.subCategoryIds !== undefined ? payload.subCategoryIds : existingFreeCash.subCategoryIds
      }, files, existingFreeCash);
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

    const previousStatus = existingFreeCash.status;
    const previousEndDate = existingFreeCash.endDate ? new Date(existingFreeCash.endDate).getTime() : null;

    // Whole days in the campaign's timezone (re-worked if only the timezone changed).
    existingFreeCash.startDate = startOfDayInZone(dateCheck.startKey, dateCheck.timezone);
    existingFreeCash.endDate = endOfDayInZone(dateCheck.endKey, dateCheck.timezone);
    existingFreeCash.timezone = dateCheck.timezone;

    // A moved end date gets its own "Expiring Soon" reminder.
    const endDateChanged = (existingFreeCash.endDate ? new Date(existingFreeCash.endDate).getTime() : null) !== previousEndDate;
    if (endDateChanged) existingFreeCash.expiryReminderSentAt = null;
    if (payload.validAbove !== undefined) existingFreeCash.validAbove = payload.validAbove;
    if (payload.canBeUsedWithOtherDiscounts !== undefined) existingFreeCash.canBeUsedWithOtherDiscounts = payload.canBeUsedWithOtherDiscounts === true;
    if (payload.remarks !== undefined) existingFreeCash.remarks = payload.remarks;

    if (payload.status && payload.status !== existingFreeCash.status && ['A', 'I'].includes(payload.status)) {
      if (payload.status === 'A') {
        existingFreeCash.activeMarkedBy = userId;
        existingFreeCash.activeMarkedDate = new Date();
      } else if (payload.status === 'I') {
        existingFreeCash.inActiveMarkedBy = userId;
        existingFreeCash.inactiveMarkedDate = new Date();
      }
      existingFreeCash.status = payload.status;
    }

    existingFreeCash.updatedBy = userId;

    await existingFreeCash.save();

    if (endDateChanged) {
      await UserFreeCash.updateMany({ vendorId, freeCashId: existingFreeCash._id }, { $set: { expiryReminderSentAt: null } });
    }

    // The grants follow a changed customer list (only between the two
    // user-targeted options - an ALL_USERS/category campaign has no list).
    let grantChanges = { issuedCount: 0, revokedCount: 0 };
    if (targetingFieldsTouched && USER_TARGETED_OPTIONS.includes(existingFreeCash.giveFreeCashTo)) {
      grantChanges = await syncTargetedGrants(
        vendorId, existingFreeCash, previousTargetUsers, resolvedTargets.giveToUsers, userId,
        emailContext.companySettingsData, { companyMasterData, websiteMasterData }
      );
    }

    if (emailContext.notifyCustomers && existingFreeCash.status === 'A' && previousStatus !== 'A') {
      promotionEmailService.notifyFreeCashCredited({
        vendorId, freeCash: existingFreeCash, companyMasterData, websiteMasterData, companySettingsData: emailContext.companySettingsData, userId
      });
    }

    logger.logInfo(1, 0, 'Free Cash updated successfully', { vendorId, freeCashId, ...grantChanges });

    return common.returnResult(true, 200, 'Free Cash updated successfully', { data: existingFreeCash, excelReports, ...grantChanges });
  } catch (err) {
    throw err;
  }
};

// Single-Free Cash status flip used only by the bulk endpoint below - a
// fresh, minimal function rather than reusing updateFreeCash (which also
// re-validates/re-resolves the full targeting payload).
const setFreeCashStatusForBulk = async (vendorId, userId, freeCashId, status, emailContext = {}) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCash = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCash) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }
    const wasActive = freeCash.status === 'A';

    if (status === 'A') {
      freeCash.activeMarkedBy = userId;
      freeCash.activeMarkedDate = new Date();
    } else {
      freeCash.inActiveMarkedBy = userId;
      freeCash.inactiveMarkedDate = new Date();
    }
    freeCash.status = status;
    freeCash.updatedBy = userId;

    await freeCash.save();

    if (emailContext.notifyCustomers && status === 'A' && !wasActive) {
      promotionEmailService.notifyFreeCashCredited({ vendorId, freeCash, ...emailContext, userId });
    }
    return common.returnResult(true, 200, `Free Cash ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    throw err;
  }
};

const bulkSetFreeCashStatus = async (vendorId, userId, freeCashIds, status, emailContext = {}) => {
  try {
    const { results, successCount, failureCount } = await common.runBulkOperation(
      freeCashIds,
      (id) => setFreeCashStatusForBulk(vendorId, userId, id, status, emailContext)
    );

    logger.logInfo(successCount, failureCount, 'Bulk Free Cash status update completed', { vendorId, status, successCount, failureCount });

    return common.returnResult(
      true, 200,
      `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${freeCashIds.length} Free Cash record(s).`,
      { results, successCount, failureCount }
    );
  } catch (err) {
    throw err;
  }
};

const bulkDeleteFreeCash = async (vendorId, userId, freeCashIds) => {
  try {
    const { results, successCount, failureCount } = await common.runBulkOperation(
      freeCashIds,
      (id) => deleteFreeCash(vendorId, id, userId)
    );

    logger.logInfo(successCount, failureCount, 'Bulk Free Cash delete completed', { vendorId, successCount, failureCount });

    return common.returnResult(
      true, 200,
      `Deleted ${successCount} of ${freeCashIds.length} Free Cash record(s).`,
      { results, successCount, failureCount }
    );
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

// emailContext = { companyMasterData, websiteMasterData, companySettingsData } -
// the customers whose Free Cash is revoked are emailed (Free Cash Revoked).
// customerEmail: the admin picks the customer by email (never by id, which
// they don't see) - matched exactly, case-insensitively, within this store.
const revokeFreeCashForUser = async (vendorId, customerEmail, freeCashId, adminUserId, emailContext = {}) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const email = String(customerEmail || '').trim();
    if (!email) {
      return common.returnResult(false, 400, 'Customer email is required.');
    }

    const freeCashDoc = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCashDoc) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    const customer = await User.findOne({
      vendorId, role: 'user', status: { $ne: 'D' },
      email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' }
    }, { _id: 1, email: 1 });
    if (!customer) {
      return common.returnResult(false, 404, `No customer with the email "${email}" was found in your store.`);
    }

    const revokeFilter = { vendorId, freeCashId, userId: customer._id, isRevoked: false, isCashUsed: false, status: { $ne: 'D' } };
    const revokedGrants = await UserFreeCash.find(revokeFilter).lean();
    if (revokedGrants.length === 0) {
      return common.returnResult(false, 404, `${customer.email} has no unused balance of this Free Cash to revoke.`);
    }

    const result = await UserFreeCash.updateMany(
      revokeFilter,
      { $set: { isRevoked: true, revokedBy: adminUserId, revokedDate: new Date() } }
    );
    promotionEmailService.notifyFreeCashRevoked({ vendorId, grants: revokedGrants, ...emailContext, userId: adminUserId });

    logger.logInfo(1, 0, 'Free Cash revoked for user', { vendorId, freeCashId, targetUserId: customer._id });

    return common.returnResult(true, 200, `Free Cash revoked for ${customer.email}.`, { revokedCount: result.modifiedCount });
  } catch (err) {
    throw err;
  }
};

const revokeFreeCashForAllUsers = async (vendorId, freeCashId, adminUserId, emailContext = {}) => {
  try {
    const idCheck = common.validateObjectId(freeCashId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const freeCashDoc = await FreeCash.findOne({ _id: freeCashId, vendorId, status: { $ne: 'D' } });
    if (!freeCashDoc) {
      return common.returnResult(false, 404, 'Free Cash not found.');
    }

    const revokeFilter = { vendorId, freeCashId, isRevoked: false, isCashUsed: false, status: { $ne: 'D' } };
    const revokedGrants = await UserFreeCash.find(revokeFilter).lean();
    const result = await UserFreeCash.updateMany(
      revokeFilter,
      { $set: { isRevoked: true, revokedBy: adminUserId, revokedDate: new Date() } }
    );
    promotionEmailService.notifyFreeCashRevoked({ vendorId, grants: revokedGrants, ...emailContext, userId: adminUserId });

    logger.logInfo(1, 0, 'Free Cash revoked for all users', { vendorId, freeCashId });

    return common.returnResult(true, 200, 'Free Cash revoked for all users successfully', { revokedCount: result.modifiedCount });
  } catch (err) {
    throw err;
  }
};

module.exports = {
  buildUsersSampleFile,
  countFreeCashCreatedThisMonth,
  countFreeCashCreatedTotal,
  issueUserFreeCash,
  createFreeCash,
  updateFreeCash,
  fetchFreeCashById,
  fetchAllFreeCashAdmin,
  deleteFreeCash,
  bulkSetFreeCashStatus,
  bulkDeleteFreeCash,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers,
  // For tests only (tests/excelUploadErrors.test.js).
  _internal: {
    resolveGiveFreeCashToTargets,
    resolveActiveGroupMembers
  }
};
