const stateMasterService = require('../services/stateMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getStates = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await stateMasterService.fetchStatesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching states', { error });
  }
};

module.exports = {
  getStates,
};