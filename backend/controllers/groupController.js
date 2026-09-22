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
    // members are ids of the referenced collection (Product/Category/User/
    // Brand/Order) - now encoded like everywhere else, since every one of
    // those collections' own endpoints encodes its ids too as of this
    // rollout (Order's own encoding lands in a parallel task).
    members: (group.members || []).map((id) => common.encodeId(id)),
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
    if (payload.members) payload.members = payload.members.map((id) => common.decodeId(id));
    const files = req.files || {};

    const result = await groupService.createGroup(vendorId, userId, payload, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta?.excelReport ? result.meta : null);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
      excelReport: result.meta.excelReport,
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
    if (payload.members) payload.members = payload.members.map((id) => common.decodeId(id));
    const files = req.files || {};

    const result = await groupService.updateGroup(vendorId, userId, groupId, payload, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta?.excelReport ? result.meta : null);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      group: formatGroupForResponse(result.meta.group),
      excelReport: result.meta.excelReport,
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

const bulkSetGroupStatus = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { groupIds, status } = req.body;

    const decodedIds = groupIds.map((id) => common.decodeId(id));

    const result = await groupService.bulkSetGroupStatus(vendorId, userId, decodedIds, status);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    // Re-encode ids before they leave the server - the caller only ever
    // knows its groups by their encoded id, same as everywhere else on
    // this controller.
    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };

    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('Error bulk updating group status', { error });
  }
};

const bulkDeleteGroups = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { groupIds } = req.body;

    const decodedIds = groupIds.map((id) => common.decodeId(id));

    const result = await groupService.bulkDeleteGroups(vendorId, userId, decodedIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };

    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('Error bulk deleting groups', { error });
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