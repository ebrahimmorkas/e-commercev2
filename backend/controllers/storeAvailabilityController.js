const storeAvailabilityService = require('../services/storeAvailabilityService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Public - tells the frontend whether to show the maintenance / plan expired
// page instead of the storefront or admin panel. `status` is null while the
// store is open.
const getStoreAvailability = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const result = storeAvailabilityService.getStoreAvailability(
      req.websiteMasterData,
      req.companyMasterData,
      req.companySettingsData
    );
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching store availability', { vendorId, error });
  }
};

module.exports = {
  getStoreAvailability
};
