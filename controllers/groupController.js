const groupService = require('../services/groupService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const GROUP_FEATURE_WEBSITE_FIELD = 'isGroupFeatureOn';
const GROUP_FEATURE_COMPANY_FIELD = 'isGroupFeatureOn';

// Converts a Group mongoose doc into a plain object with every ObjectId
// that can leave the server encoded via common.encodeId.
const formatGroupForResponse = (groupDoc) => {
  const group = groupDoc.toObject ? groupDoc.toObject() : groupDoc;

  return {
    ...group,
    _id: common.encodeId(group._id),
    vendorId: common.encodeId(group.vendorId),
    members: (group.members || []).map((memberId) => common.encodeId(memberId)),
    createdBy: group.createdBy ? common.encodeId(group.createdBy) : group.createdBy,
    updatedBy: group.updatedBy ? common.encodeId(group.updatedBy) : group.updatedBy,
    deletedBy: group.deletedBy ? common.encodeId(group.deletedBy) : group.deletedBy,
    activeMarkedBy: group.activeMarkedBy ? common.encodeId(group.activeMarkedBy) : group.activeMarkedBy,
    inActiveMarkedBy: group.inActiveMarkedBy ? common.encodeId(group.inActiveMarkedBy) : group.inActiveMarkedBy,
  };
};

const createGroup = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const payload = { ...req.body };
    if (Array.isArray(payload.members)) {
      payload.members = payload.members.map((memberId) => common.decodeId(memberId));
    }

    const result = await groupService.createGroup(vendorId, userId, payload, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error creating group', { error });
  }
};

const getGroupById = async (req, res) => {
  try {
    const vendorId = req.vendorId;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const groupId = common.decodeId(req.params.id);

    const result = await groupService.getGroupById(vendorId, groupId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error fetching group by id', { error });
  }
};

const getAllGroups = async (req, res) => {
  try {
    const vendorId = req.vendorId;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const filters = {};
    if (req.query.groupType) filters.groupType = req.query.groupType;

    const result = await groupService.getAllGroups(vendorId, filters);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      groups: result.meta.groups.map(formatGroupForResponse),
      count: result.meta.count,
    });
  } catch (error) {
    logger.logException('Error fetching all groups', { error });
  }
};

const updateGroup = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const groupId = common.decodeId(req.body.id);

    const payload = { ...req.body };
    delete payload.id;
    if (Array.isArray(payload.members)) {
      payload.members = payload.members.map((memberId) => common.decodeId(memberId));
    }

    const result = await groupService.updateGroup(vendorId, userId, groupId, payload, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error updating group', { error });
  }
};

const softDeleteGroup = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const groupId = common.decodeId(req.body.id);

    const result = await groupService.softDeleteGroup(vendorId, userId, groupId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error deleting group', { error });
  }
};

const activateGroup = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const groupId = common.decodeId(req.body.id);

    const result = await groupService.activateGroup(vendorId, userId, groupId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error activating group', { error });
  }
};

const deactivateGroup = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;

    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      req.websiteMasterData,
      req.companyMasterData,
      GROUP_FEATURE_WEBSITE_FIELD,
      GROUP_FEATURE_COMPANY_FIELD
    );
    if (!featureCheck.isSuccess) {
      return common.sendError(res, featureCheck.statusCode, featureCheck.message);
    }

    const groupId = common.decodeId(req.body.id);

    const result = await groupService.deactivateGroup(vendorId, userId, groupId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
    });
  } catch (error) {
    logger.logException('Error deactivating group', { error });
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