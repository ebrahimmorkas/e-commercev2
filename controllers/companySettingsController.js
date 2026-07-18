const companySettingsService = require('../services/companySettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const getCompanySettings = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const settings = await companySettingsService.fetchCompanySettingsByVendorId(vendorId);
    if (!settings) {
      return common.sendError(res, 404, "Company settings not found");
    }
    return common.sendSuccess(res, 200, "Company settings fetched successfully", settings);
  } catch (error) {
    logger.logException('Error fetching company settings', { vendorId, error });
    return common.sendError(res, 500, "Failed to fetch company settings");
  }
};

module.exports = {
  getCompanySettings
};