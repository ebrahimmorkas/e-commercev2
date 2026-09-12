const abandonedCartService = require('../services/abandonedCartService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

/**
 * Both websiteMaster (global) and companyMaster (vendor-specific) must have
 * isAbondonedCartFeatureOn === true for the admin to view abandoned carts.
 * req.websiteMasterData / req.companyMasterData are populated upstream by
 * the ensureVendorDataCached middleware.
 *
 * Returns null if the feature is enabled, or an { statusCode, message } object if blocked.
 */
const getAbandonedCartFeatureBlockReason = async (req) => {
  const websiteMasterData = req.websiteMasterData;
  const companyMasterData = req.companyMasterData;

  const isAbandonedCartFeatureOn = await common.checkFeatureOnOrOff(
    req.vendorId, websiteMasterData, companyMasterData, 'isAbondonedCartFeatureOn', 'isAbondonedCartFeatureOn'
  );

  if (!isAbandonedCartFeatureOn.isSuccess) {
    return {
      statusCode: 403,
      message: isAbandonedCartFeatureOn.message || 'This feature is temporarily unavailable'
    };
  }

  return null;
};

const getAllAbandonedCartsAdmin = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const blockReason = await getAbandonedCartFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await abandonedCartService.fetchAbandonedCartsForAdmin(vendorId, req.companySettingsData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
  } catch (error) {
    logger.logException('abandonedCartController: getAllAbandonedCartsAdmin - Exception while fetching abandoned carts', { vendorId, error });
  }
};

module.exports = {
  getAllAbandonedCartsAdmin
};
