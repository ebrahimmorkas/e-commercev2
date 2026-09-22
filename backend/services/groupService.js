const mongoose = require('mongoose');
const Group = require('../models/Group');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const logger = require('../utils/logger');
const common = require('../utils/common');
const { parseExcelBuffer } = require('../utils/excelParser');
const { processExcelRows } = require('../utils/excelRowProcessor');
const {
  bulkGroupProductNameRowSchema,
  bulkGroupCategoryNameRowSchema,
  bulkGroupUserEmailRowSchema
} = require('../middlewares/validations/groupValidations');
const {
  EXCEL_UPLOAD_GROUP_TYPES,
  EXCEL_SHEET_NAME_BY_GROUP_TYPE,
  PRODUCTS_EXCEL_COLUMNS,
  CATEGORIES_EXCEL_COLUMNS,
  USERS_EXCEL_COLUMNS,
  CATEGORY_PATH_SEPARATOR
} = require('../constants/groupConstants');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Maps a groupType to the Mongo model its `members` array should reference.
// CUSTOM groups are intentionally excluded - members can be anything.
const GROUP_TYPE_MODEL_MAP = {
  PRODUCT: 'Product',
  CATEGORY: 'Category',
  USER: 'User',
  BRAND: 'BrandMaster',
  ORDER: 'Order',
};

// An empty/missing allowedGroupTypes is treated as "all types allowed" -
// fail-open, same philosophy as frontend/.../navItems.js's
// filterNavItemsByAssignedModules, so a vendor whose CompanyMaster predates
// this field isn't suddenly locked out of every groupType.
const checkAllowedGroupType = (groupType, companyMasterData) => {
  const allowed = companyMasterData && companyMasterData.allowedGroupTypes;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return { valid: true };
  }
  if (!allowed.includes(groupType)) {
    return { valid: false, message: `Group type ${groupType} is not enabled for your account.` };
  }
  return { valid: true };
};

// Resolves a "Category Name" (+ optional "Sub Category", a ">"-separated
// chain of nested names) into the deepest matching category doc. Category
// Name always anchors to a ROOT category (parent_category_id null) - Sub
// Category then walks down one child-by-name lookup per segment. Requires
// isNestingCategoryAllowed when Sub Category is non-empty.
const resolveCategoryPath = async (vendorId, categoryName, subCategoryRaw, isNestingCategoryAllowed) => {
  const subCategoryTrimmed = (subCategoryRaw || '').trim();

  if (subCategoryTrimmed && !isNestingCategoryAllowed) {
    return { found: false, message: 'Sub Category is not allowed - nesting is off for your account.' };
  }

  const root = await Category.findOne({
    vendorId, status: 'A', parent_category_id: null,
    categoryName: { $regex: `^${escapeRegex(categoryName.trim())}$`, $options: 'i' }
  });
  if (!root) {
    return { found: false, message: `Category "${categoryName}" not found` };
  }

  if (!subCategoryTrimmed) {
    return { found: true, category: root };
  }

  const segments = subCategoryTrimmed.split(CATEGORY_PATH_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    const child = await Category.findOne({
      vendorId, status: 'A', parent_category_id: current._id,
      categoryName: { $regex: `^${escapeRegex(segment)}$`, $options: 'i' }
    });
    if (!child) {
      return { found: false, message: `Sub-category "${segment}" not found under "${current.categoryName}"` };
    }
    current = child;
  }

  return { found: true, category: current };
};

// When nesting is disallowed, rejects a manually-picked (non-excel) members
// array that contains any category which isn't a root category. A no-op for
// non-CATEGORY groupTypes and whenever nesting is allowed.
const validateCategoryNestingRule = async (vendorId, members, isNestingCategoryAllowed) => {
  if (isNestingCategoryAllowed) {
    return { valid: true };
  }
  const nestedCount = await Category.countDocuments({
    _id: { $in: members }, vendorId, parent_category_id: { $ne: null }
  });
  if (nestedCount > 0) {
    return {
      valid: false,
      message: 'Sub-categories are not allowed - nesting is off for your account. Only main (top-level) categories can be selected.'
    };
  }
  return { valid: true };
};

// Resolves an uploaded excel file's rows into real member ids for
// PRODUCT/CATEGORY/USER groupTypes, matching by name/email within this
// vendor. Mirrors discountService's excel-targeting resolution.
const resolveMembersFromExcel = async (vendorId, groupType, excelBuffer, isNestingCategoryAllowed) => {
  try {
    const sheetName = EXCEL_SHEET_NAME_BY_GROUP_TYPE[groupType];
    if (!sheetName) {
      return common.returnResult(false, 400, `Excel upload is not supported for group type ${groupType}.`);
    }

    const columnsByType = {
      PRODUCT: PRODUCTS_EXCEL_COLUMNS,
      CATEGORY: CATEGORIES_EXCEL_COLUMNS,
      USER: USERS_EXCEL_COLUMNS
    };
    const rowSchemaByType = {
      PRODUCT: bulkGroupProductNameRowSchema,
      CATEGORY: bulkGroupCategoryNameRowSchema,
      USER: bulkGroupUserEmailRowSchema
    };

    let rows;
    try {
      ({ rows } = await parseExcelBuffer(excelBuffer, columnsByType[groupType], { sheetName }));
    } catch (err) {
      if (String(err.message).includes('was not found')) {
        return common.returnResult(false, 400, `"${sheetName}" sheet is required in the excel file for this group type.`);
      }
      throw err;
    }

    if (rows.length === 0) {
      return common.returnResult(false, 400, 'Excel file contains no data rows.');
    }

    const memberIds = [];
    const excelReport = await processExcelRows(
      rows,
      async (row) => {
        const { error, value } = rowSchemaByType[groupType].validate(row, { abortEarly: false });
        if (error) {
          return { success: false, errors: error.details.map((d) => d.message.replace(/"/g, '')) };
        }

        if (groupType === 'PRODUCT') {
          const doc = await Product.findOne({
            vendorId, status: 'A',
            name: { $regex: `^${escapeRegex(value.productName.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`Product "${value.productName}" not found`] };
          }
          memberIds.push(doc._id.toString());
          return { success: true };
        }

        if (groupType === 'USER') {
          const doc = await User.findOne({
            vendorId, status: { $ne: 'D' },
            email: { $regex: `^${escapeRegex(value.email.trim())}$`, $options: 'i' }
          });
          if (!doc) {
            return { success: false, errors: [`User with email "${value.email}" not found`] };
          }
          memberIds.push(doc._id.toString());
          return { success: true };
        }

        // CATEGORY
        const resolved = await resolveCategoryPath(vendorId, value.categoryName, value.subCategory, isNestingCategoryAllowed);
        if (!resolved.found) {
          return { success: false, errors: [resolved.message] };
        }
        memberIds.push(resolved.category._id.toString());
        return { success: true };
      },
      { allowPartialSuccess: true, useTransaction: false }
    );

    if (excelReport.totalRows > 0 && excelReport.successCount === 0) {
      return common.returnResult(false, 400, 'None of the rows in the uploaded excel file could be matched.', { excelReport });
    }

    return common.returnResult(true, 200, 'Excel file processed.', { memberIds, excelReport });
  } catch (err) {
    throw err;
  }
};

// Validates that every member ID actually exists in the collection that
// corresponds to the group's groupType.
const validateMembersAgainstGroupType = async (groupType, members) => {
  try {
    if (groupType === 'CUSTOM') {
      return { valid: true };
    }

    const modelName = GROUP_TYPE_MODEL_MAP[groupType];
    if (!modelName) {
      return { valid: false, message: `Unsupported group type: ${groupType}` };
    }

    let Model;
    try {
      Model = mongoose.model(modelName);
    } catch (err) {
      return { valid: false, message: `Referenced model "${modelName}" is not registered.` };
    }

    const modelCheck = common.validateModelExists(Model);
    if (!modelCheck.valid) {
      return { valid: false, message: modelCheck.message };
    }

    for (const memberId of members) {
      const idCheck = common.validateObjectId(memberId);
      if (!idCheck.valid) {
        return { valid: false, message: `Invalid member ID: ${memberId}` };
      }
    }

    const foundCount = await Model.countDocuments({ _id: { $in: members } });
    if (foundCount !== members.length) {
      return { valid: false, message: `One or more members are invalid for group type ${groupType}.` };
    }

    return { valid: true };
  } catch (err) {
    throw err;
  }
};

const createGroup = async (vendorId, userId, payload, files, companyMasterData) => {
  try {
    const { groupType, groupName, slug, description, precedence, remarks } = payload;

    if (!groupType || !groupName) {
      return common.returnResult(false, 400, "groupType and groupName are required.");
    }

    const allowedCheck = checkAllowedGroupType(groupType, companyMasterData);
    if (!allowedCheck.valid) {
      return common.returnResult(false, 403, allowedCheck.message);
    }

    let members = payload.members;
    let excelReport = null;
    const excelFile = files && files.excelFile && files.excelFile[0];

    if (excelFile) {
      if (!EXCEL_UPLOAD_GROUP_TYPES.includes(groupType)) {
        return common.returnResult(false, 400, `Excel upload is not supported for group type ${groupType}.`);
      }
      const excelResult = await resolveMembersFromExcel(vendorId, groupType, excelFile.buffer, companyMasterData.isNestingCategoryAllowedInGroup);
      if (!excelResult.isSuccess) {
        return excelResult;
      }
      members = excelResult.meta.memberIds;
      excelReport = excelResult.meta.excelReport;
    }

    if (!Array.isArray(members) || members.length === 0) {
      return common.returnResult(false, 400, "At least one member is required.");
    }

    if (members.length > companyMasterData.numberOfMembersPerGroup) {
      return common.returnResult(false, 400, `A group can have at most ${companyMasterData.numberOfMembersPerGroup} members.`);
    }

    const memberValidation = await validateMembersAgainstGroupType(groupType, members);
    if (!memberValidation.valid) {
      return common.returnResult(false, 400, memberValidation.message);
    }

    if (groupType === 'CATEGORY') {
      const nestingValidation = await validateCategoryNestingRule(vendorId, members, companyMasterData.isNestingCategoryAllowedInGroup);
      if (!nestingValidation.valid) {
        return common.returnResult(false, 400, nestingValidation.message);
      }
    }

    const activeGroupCount = await Group.countDocuments({ vendorId, status: { $ne: 'D' } });
    if (activeGroupCount >= companyMasterData.numberOfGroupsAllowed) {
      return common.returnResult(false, 403, `You have reached the maximum number of groups (${companyMasterData.numberOfGroupsAllowed}) allowed.`);
    }

    const newGroup = await Group.create({
      vendorId,
      groupType,
      groupName,
      slug,
      description,
      members,
      membersCount: members.length,
      precedence,
      remarks,
      status: 'A',
      createdBy: userId,
    });

    return common.returnResult(true, 201, "Group created successfully.", { group: newGroup, excelReport });
  } catch (err) {
    throw err;
  }
};

const getGroupById = async (vendorId, groupId) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId, status: { $ne: 'D' } });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    return common.returnResult(true, 200, "Group fetched successfully.", { group });
  } catch (err) {
    throw err;
  }
};

const getAllGroups = async (vendorId, filters = {}) => {
  try {
    const query = { vendorId, status: { $ne: 'D' }, ...filters };
    const groups = await Group.find(query).sort({ precedence: 1, createdAt: -1 });
    return common.returnResult(true, 200, "Groups fetched successfully.", { groups, count: groups.length });
  } catch (err) {
    throw err;
  }
};

const updateGroup = async (vendorId, userId, groupId, payload, files, companyMasterData) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId, status: { $ne: 'D' } });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    const { groupType, groupName, slug, description, precedence, remarks } = payload;
    const effectiveGroupType = groupType !== undefined ? groupType : group.groupType;

    if (groupType !== undefined) {
      const allowedCheck = checkAllowedGroupType(groupType, companyMasterData);
      if (!allowedCheck.valid) {
        return common.returnResult(false, 403, allowedCheck.message);
      }
    }

    let members = payload.members;
    let excelReport = null;
    const excelFile = files && files.excelFile && files.excelFile[0];

    if (excelFile) {
      if (!EXCEL_UPLOAD_GROUP_TYPES.includes(effectiveGroupType)) {
        return common.returnResult(false, 400, `Excel upload is not supported for group type ${effectiveGroupType}.`);
      }
      const excelResult = await resolveMembersFromExcel(vendorId, effectiveGroupType, excelFile.buffer, companyMasterData.isNestingCategoryAllowedInGroup);
      if (!excelResult.isSuccess) {
        return excelResult;
      }
      members = excelResult.meta.memberIds;
      excelReport = excelResult.meta.excelReport;
    }

    if (members !== undefined) {
      if (!Array.isArray(members) || members.length === 0) {
        return common.returnResult(false, 400, "At least one member is required.");
      }

      if (members.length > companyMasterData.numberOfMembersPerGroup) {
        return common.returnResult(false, 400, `A group can have at most ${companyMasterData.numberOfMembersPerGroup} members.`);
      }

      const memberValidation = await validateMembersAgainstGroupType(effectiveGroupType, members);
      if (!memberValidation.valid) {
        return common.returnResult(false, 400, memberValidation.message);
      }

      if (effectiveGroupType === 'CATEGORY') {
        const nestingValidation = await validateCategoryNestingRule(vendorId, members, companyMasterData.isNestingCategoryAllowedInGroup);
        if (!nestingValidation.valid) {
          return common.returnResult(false, 400, nestingValidation.message);
        }
      }

      group.members = members;
      group.membersCount = members.length;
    }

    if (groupType !== undefined) group.groupType = groupType;
    if (groupName !== undefined) group.groupName = groupName;
    if (slug !== undefined) group.slug = slug;
    if (description !== undefined) group.description = description;
    if (precedence !== undefined) group.precedence = precedence;
    if (remarks !== undefined) group.remarks = remarks;
    group.updatedBy = userId;

    await group.save();

    return common.returnResult(true, 200, "Group updated successfully.", { group, excelReport });
  } catch (err) {
    throw err;
  }
};

const softDeleteGroup = async (vendorId, userId, groupId) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    if (group.status === 'D') {
      return common.returnResult(false, 400, "Group is already deleted.");
    }

    group.status = 'D';
    group.deletedBy = userId;
    await group.save({ validateBeforeSave: false });

    return common.returnResult(true, 200, "Group deleted successfully.", { group });
  } catch (err) {
    throw err;
  }
};

const activateGroup = async (vendorId, userId, groupId) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId, status: { $ne: 'D' } });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    if (group.status === 'A') {
      return common.returnResult(false, 400, "Group is already active.");
    }

    group.status = 'A';
    group.activeMarkedBy = userId;
    group.activeMarkedDate = new Date();
    await group.save({ validateBeforeSave: false });

    return common.returnResult(true, 200, "Group activated successfully.", { group });
  } catch (err) {
    throw err;
  }
};

const deactivateGroup = async (vendorId, userId, groupId) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId, status: { $ne: 'D' } });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    if (group.status === 'I') {
      return common.returnResult(false, 400, "Group is already inactive.");
    }

    group.status = 'I';
    group.inActiveMarkedBy = userId;
    group.inActiveMarkedDate = new Date();
    await group.save({ validateBeforeSave: false });

    return common.returnResult(true, 200, "Group deactivated successfully.", { group });
  } catch (err) {
    throw err;
  }
};

// Bulk multi-select actions (frontend checkbox selection) - reuse the
// existing single-group functions above as-is (same "already active" /
// "already inactive" / not-found business rules, same audit fields).
const bulkSetGroupStatus = async (vendorId, userId, groupIds, status) => {
  try {
    const operationFn = status === 'A'
      ? (id) => activateGroup(vendorId, userId, id)
      : (id) => deactivateGroup(vendorId, userId, id);

    const { results, successCount, failureCount } = await common.runBulkOperation(groupIds, operationFn);

    return common.returnResult(
      true, 200,
      `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${groupIds.length} group(s).`,
      { results, successCount, failureCount }
    );
  } catch (err) {
    throw err;
  }
};

const bulkDeleteGroups = async (vendorId, userId, groupIds) => {
  try {
    const { results, successCount, failureCount } = await common.runBulkOperation(
      groupIds,
      (id) => softDeleteGroup(vendorId, userId, id)
    );

    return common.returnResult(
      true, 200,
      `Deleted ${successCount} of ${groupIds.length} group(s).`,
      { results, successCount, failureCount }
    );
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createGroup,
  getGroupById,
  getAllGroups,
  updateGroup,
  softDeleteGroup,
  activateGroup,
  deactivateGroup,
  bulkSetGroupStatus,
  bulkDeleteGroups,
};