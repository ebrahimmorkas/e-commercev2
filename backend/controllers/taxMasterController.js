const taxMasterService = require('../services/taxMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getTaxes = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await taxMasterService.fetchTaxesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching taxes', { error });
  }
};

module.exports = {
  getTaxes,
};