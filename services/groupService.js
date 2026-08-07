const mongoose = require('mongoose');
const Group = require('../models/Group');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Maps a groupType to the Mongo model its `members` array should reference.
// CUSTOM groups are intentionally excluded - members can be anything.
const GROUP_TYPE_MODEL_MAP = {
  PRODUCT: 'Product',
  CATEGORY: 'Category',
  USER: 'User',
  BRAND: 'Brand',
  TAG: 'Tag',
  ORDER: 'Order',
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

const createGroup = async (vendorId, userId, payload, companyMasterData) => {
  try {
    const { groupType, groupName, slug, description, members, precedence, remarks } = payload;

    if (!groupType || !groupName) {
      return common.returnResult(false, 400, "groupType and groupName are required.");
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

    return common.returnResult(true, 201, "Group created successfully.", { group: newGroup });
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

const updateGroup = async (vendorId, userId, groupId, payload, companyMasterData) => {
  try {
    const idCheck = common.validateObjectId(groupId);
    if (!idCheck.valid) {
      return common.returnResult(false, 400, idCheck.message);
    }

    const group = await Group.findOne({ _id: groupId, vendorId, status: { $ne: 'D' } });
    if (!group) {
      return common.returnResult(false, 404, "Group not found.");
    }

    const { groupType, groupName, slug, description, members, precedence, remarks } = payload;
    const effectiveGroupType = groupType !== undefined ? groupType : group.groupType;

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

    return common.returnResult(true, 200, "Group updated successfully.", { group });
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
    group.inactiveMarkedDate = new Date();
    await group.save({ validateBeforeSave: false });

    return common.returnResult(true, 200, "Group deactivated successfully.", { group });
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
};