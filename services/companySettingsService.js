const CompanySettings = require('../models/CompanySettings');
const logger = require('../utils/logger');

const fetchCompanySettingsByVendorId = async (vendorId) => {
    try {
        logger.logInfo(null,null,'Fetching company settings from DB', { vendorId });
        const settings = await CompanySettings.findOne({ vendorId });
        if (!settings) {
            logger.logError(0,1,'Company settings not found', { vendorId });
            return null;
        }
        logger.logInfo(1,0,'Company settings fetched successfully', { vendorId });
        return settings;
    } catch (err) {
        throw err;
    }
}

module.exports = {
  fetchCompanySettingsByVendorId
};