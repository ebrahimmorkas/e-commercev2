const companyMasterService = require('../services/companyMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getCompanyMasterData = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const companyMasterData = await companyMasterService.fetchCompanyMasterByVendorId(vendorId);
    if (!companyMasterData) {
      return common.sendError(res, 404, "Company master data not found");
    }
    return common.sendSuccess(res, 200, "Company master data fetched successfully", companyMasterData);
  } catch (error) {
    logger.logException('Error fetching company master data', { vendorId, error });
    return common.sendError(res, 500, "Failed to fetch company master data");
  }
};

module.exports = {
  getCompanyMasterData
};