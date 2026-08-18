const locationTaxBundleService = require('../services/locationTaxBundleService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getLocationTaxBundle = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await locationTaxBundleService.fetchLocationTaxBundleForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching location and tax bundle', { error });
  }
};

module.exports = {
  getLocationTaxBundle,
};