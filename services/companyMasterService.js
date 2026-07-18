const CompanyMaster = require('../models/CompanyMaster');
const logger = require('../utils/logger');

const fetchCompanyMasterByVendorId = async (vendorId) => {
  try {
    logger.logInfo('Fetching company master data from DB', { vendorId });
  const companyMasterData = await CompanyMaster.findOne({ vendorId });
  // console.log(`companyMaster data is: ${companyMasterData} and vendorId is ${vendorId}`)
  if (!companyMasterData) {
    logger.logError('Company master data not found', { vendorId });
    return null;
  }
  logger.logInfo('Company master data fetched successfully', { vendorId });
  return companyMasterData;
  } catch(err) {
    throw err;
  }
};

module.exports = {
  fetchCompanyMasterByVendorId
};