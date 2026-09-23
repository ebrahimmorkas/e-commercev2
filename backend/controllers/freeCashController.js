const freeCashService = require('../services/freeCashService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const encodeIdArray = (ids) => (Array.isArray(ids) ? ids.map((id) => common.encodeId(id)) : ids);

// giveToUsers is resolved server-side from an uploaded excel file (see
// resolveGiveFreeCashToTargets in freeCashService.js), never submitted by
// the client as ids - but it's still real ids once stored, so it's encoded
// on the way out same as everything else. userGroupIds/mainCategoryIds/
// subCategoryIds ARE submitted directly by the client.
const formatFreeCashForResponse = (freeCashDoc) => {
  if (!freeCashDoc) return freeCashDoc;
  const freeCash = freeCashDoc.toObject ? freeCashDoc.toObject() : freeCashDoc;

  return {
    ...freeCash,
    _id: freeCash._id ? common.encodeId(freeCash._id) : freeCash._id,
    vendorId: freeCash.vendorId ? common.encodeId(freeCash.vendorId) : freeCash.vendorId,
    giveToUsers: encodeIdArray(freeCash.giveToUsers),
    userGroupIds: encodeIdArray(freeCash.userGroupIds),
    mainCategoryIds: encodeIdArray(freeCash.mainCategoryIds),
    subCategoryIds: encodeIdArray(freeCash.subCategoryIds),
    createdBy: freeCash.createdBy ? common.encodeId(freeCash.createdBy) : freeCash.createdBy,
    updatedBy: freeCash.updatedBy ? common.encodeId(freeCash.updatedBy) : freeCash.updatedBy,
    deletedBy: freeCash.deletedBy ? common.encodeId(freeCash.deletedBy) : freeCash.deletedBy,
    inActiveMarkedBy: freeCash.inActiveMarkedBy ? common.encodeId(freeCash.inActiveMarkedBy) : freeCash.inActiveMarkedBy,
    activeMarkedBy: freeCash.activeMarkedBy ? common.encodeId(freeCash.activeMarkedBy) : freeCash.activeMarkedBy,
  };
};

// The only id-bearing fields that ever arrive directly from the client in a
// create/update Free Cash payload - giveToUsers is resolved server-side
// from an excel upload, never submitted as ids by the client.
const decodeFreeCashPayloadIds = (body) => {
  const payload = { ...body };
  ['userGroupIds', 'mainCategoryIds', 'subCategoryIds'].forEach((field) => {
    if (Array.isArray(payload[field])) {
      payload[field] = payload[field].map((id) => common.decodeId(id));
    }
  });
  return payload;
};

/**
 * Both websiteMaster (global) and companyMaster (vendor-specific) must have
 * isFreeCashFeatureOn === true for any Free Cash action to be allowed.
 * req.websiteMasterData / req.companyMasterData are populated upstream by
 * the ensureVendorDataCached middleware.
 *
 * Returns null if the feature is enabled, or an { statusCode, message } object if blocked.
 */
const getFreeCashFeatureBlockReason = async (req) => {
  const websiteMasterData = req.websiteMasterData;
  const companyMasterData = req.companyMasterData;

  const isFreeCashFeatureOn = await common.checkFeatureOnOrOff(
    req.vendorId, websiteMasterData, companyMasterData, 'isFreeCashFeatureOn', 'isFreeCashFeatureOn'
  );

  if (!isFreeCashFeatureOn.isSuccess) {
    return {
      statusCode: 403,
      message: isFreeCashFeatureOn.message || 'This feature is temporarily unavailable'
    };
  }

  return null;
};

// Checks a single websiteMaster+companyMaster boolean flag both layers -
// used for the revoke-functionality gates below.
const getFlagBlockReason = (req, flag) => {
  const websiteMasterData = req.websiteMasterData;
  const companyMasterData = req.companyMasterData;

  if (!websiteMasterData || websiteMasterData[flag] !== true) {
    return {
      statusCode: 403,
      message: (websiteMasterData && websiteMasterData.temporaryFeatureOffMessage) || 'This feature is temporarily unavailable'
    };
  }

  if (!companyMasterData || companyMasterData[flag] !== true) {
    return {
      statusCode: 403,
      message: (websiteMasterData && websiteMasterData.featureDisabledForVendorMessage) || 'This feature is not enabled for your account'
    };
  }

  return null;
};

const createFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const companyMasterData = req.companyMasterData;

    const totalLimit = companyMasterData ? companyMasterData.numberOfFreeCashToGiveAllowed : null;
    if (totalLimit !== null && totalLimit !== undefined) {
      const totalCountResult = await freeCashService.countFreeCashCreatedTotal(vendorId);
      if (!totalCountResult.isSuccess) {
        return common.sendError(res, totalCountResult.statusCode, totalCountResult.message);
      }
      if (totalCountResult.meta.count >= totalLimit) {
        return common.sendError(res, 403, `Free Cash creation limit (${totalLimit}) has been reached.`);
      }
    }

    const monthlyLimit = companyMasterData ? companyMasterData.numberOfFreeCashToGiveAllowedPerMonth : null;
    if (monthlyLimit !== null && monthlyLimit !== undefined) {
      const monthlyCountResult = await freeCashService.countFreeCashCreatedThisMonth(vendorId);
      if (!monthlyCountResult.isSuccess) {
        return common.sendError(res, monthlyCountResult.statusCode, monthlyCountResult.message);
      }
      if (monthlyCountResult.meta.count >= monthlyLimit) {
        return common.sendError(res, 403, `Monthly Free Cash creation limit (${monthlyLimit}) has been reached.`);
      }
    }

    const files = req.files || {};
    const payload = decodeFreeCashPayloadIds(req.body);
    const result = await freeCashService.createFreeCash(
      vendorId, userId, payload, files, req.companyMasterData, req.websiteMasterData, req.companySettingsData
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      ...result.meta,
      data: formatFreeCashForResponse(result.meta.data)
    });
  } catch (error) {
    logger.logException('freeCashController: createFreeCash - Exception while creating Free Cash', { vendorId, error });
  }
};

const updateFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  let freeCashId;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    freeCashId = common.decodeId(req.params.id);
    const files = req.files || {};
    const payload = decodeFreeCashPayloadIds(req.body);
    const result = await freeCashService.updateFreeCash(
      vendorId, freeCashId, userId, payload, files, req.companyMasterData, req.websiteMasterData
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

    return common.sendSuccess(res, result.statusCode, result.message, {
      ...result.meta,
      data: formatFreeCashForResponse(result.meta.data)
    });
  } catch (error) {
    logger.logException('freeCashController: updateFreeCash - Exception while updating Free Cash', { vendorId, freeCashId, error });
  }
};

const getFreeCashById = async (req, res) => {
  const vendorId = req.vendorId;
  let freeCashId;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    freeCashId = common.decodeId(req.params.id);
    const result = await freeCashService.fetchFreeCashById(vendorId, freeCashId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatFreeCashForResponse(result.meta.data));
  } catch (error) {
    logger.logException('freeCashController: getFreeCashById - Exception while fetching Free Cash', { vendorId, freeCashId, error });
  }
};

const getAllFreeCashAdmin = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await freeCashService.fetchAllFreeCashAdmin(vendorId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data.map(formatFreeCashForResponse));
  } catch (error) {
    logger.logException('freeCashController: getAllFreeCashAdmin - Exception while fetching Free Cash list', { vendorId, error });
  }
};

const deleteFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  let freeCashId;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    freeCashId = common.decodeId(req.params.id);
    const result = await freeCashService.deleteFreeCash(vendorId, freeCashId, userId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('freeCashController: deleteFreeCash - Exception while deleting Free Cash', { vendorId, freeCashId, error });
  }
};

const revokeFreeCashForUser = async (req, res) => {
  const vendorId = req.vendorId;
  const adminUserId = req.user && req.user._id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const revokeBlockReason = getFlagBlockReason(req, 'isRevokingFreeCashFunctionalityAllowed');
    if (revokeBlockReason) {
      return common.sendError(res, revokeBlockReason.statusCode, revokeBlockReason.message);
    }

    const targetUserId = common.decodeId(req.body.userId);
    const freeCashId = common.decodeId(req.body.freeCashId);
    const result = await freeCashService.revokeFreeCashForUser(vendorId, targetUserId, freeCashId, adminUserId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('freeCashController: revokeFreeCashForUser - Exception while revoking Free Cash', { vendorId, error });
  }
};

const revokeFreeCashForAllUsers = async (req, res) => {
  const vendorId = req.vendorId;
  const adminUserId = req.user && req.user._id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const revokeBlockReason = getFlagBlockReason(req, 'isRevokingAllUsersFreeCashFunctionalityAllowed');
    if (revokeBlockReason) {
      return common.sendError(res, revokeBlockReason.statusCode, revokeBlockReason.message);
    }

    const freeCashId = common.decodeId(req.body.freeCashId);
    const result = await freeCashService.revokeFreeCashForAllUsers(vendorId, freeCashId, adminUserId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('freeCashController: revokeFreeCashForAllUsers - Exception while revoking Free Cash for all users', { vendorId, error });
  }
};

const bulkSetFreeCashStatus = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  const { status } = req.body;
  try {
    const decodedIds = req.body.freeCashIds.map((id) => common.decodeId(id));
    const result = await freeCashService.bulkSetFreeCashStatus(vendorId, userId, decodedIds, status);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };
    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('freeCashController: bulkSetFreeCashStatus - Exception while bulk updating Free Cash status', { vendorId, error });
  }
};

const bulkDeleteFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  try {
    const decodedIds = req.body.freeCashIds.map((id) => common.decodeId(id));
    const result = await freeCashService.bulkDeleteFreeCash(vendorId, userId, decodedIds);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };
    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('freeCashController: bulkDeleteFreeCash - Exception while bulk deleting Free Cash', { vendorId, error });
  }
};

module.exports = {
  createFreeCash,
  updateFreeCash,
  getFreeCashById,
  getAllFreeCashAdmin,
  deleteFreeCash,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers,
  bulkSetFreeCashStatus,
  bulkDeleteFreeCash
};
