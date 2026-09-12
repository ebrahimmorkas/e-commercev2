const freeCashService = require('../services/freeCashService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

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
    const result = await freeCashService.createFreeCash(
      vendorId, userId, req.body, files, req.companyMasterData, req.websiteMasterData, req.companySettingsData
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('freeCashController: createFreeCash - Exception while creating Free Cash', { vendorId, error });
  }
};

const updateFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  const freeCashId = req.params.id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const files = req.files || {};
    const result = await freeCashService.updateFreeCash(
      vendorId, freeCashId, userId, req.body, files, req.companyMasterData, req.websiteMasterData
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('freeCashController: updateFreeCash - Exception while updating Free Cash', { vendorId, freeCashId, error });
  }
};

const getFreeCashById = async (req, res) => {
  const vendorId = req.vendorId;
  const freeCashId = req.params.id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await freeCashService.fetchFreeCashById(vendorId, freeCashId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
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

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
  } catch (error) {
    logger.logException('freeCashController: getAllFreeCashAdmin - Exception while fetching Free Cash list', { vendorId, error });
  }
};

const deleteFreeCash = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  const freeCashId = req.params.id;
  try {
    const blockReason = await getFreeCashFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

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

    const { userId: targetUserId, freeCashId } = req.body;
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

    const { freeCashId } = req.body;
    const result = await freeCashService.revokeFreeCashForAllUsers(vendorId, freeCashId, adminUserId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('freeCashController: revokeFreeCashForAllUsers - Exception while revoking Free Cash for all users', { vendorId, error });
  }
};

module.exports = {
  createFreeCash,
  updateFreeCash,
  getFreeCashById,
  getAllFreeCashAdmin,
  deleteFreeCash,
  revokeFreeCashForUser,
  revokeFreeCashForAllUsers
};
