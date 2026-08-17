const sizeMasterService = require('../services/sizeMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getSizes = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedSizeIds = req.companyMasterData?.allowedSizes || [];

    const result = await sizeMasterService.fetchSizesForVendor(vendorId, allowedSizeIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching sizes', { error });
  }
};

module.exports = {
  getSizes,
};