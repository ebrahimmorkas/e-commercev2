const CompanySettings = require('../models/CompanySettings');
const logger = require('../utils/logger');

const fetchCompanySettingsByVendorId = async (vendorId) => {
    try {
        logger.logInfo('Fetching company settings from DB', { vendorId });
        const settings = await CompanySettings.findOne({ vendorId });
        if (!settings) {
            logger.logError('Company settings not found', { vendorId });
            return null;
        }
        logger.logInfo('Company settings fetched successfully', { vendorId });
        return settings;
    } catch (err) {
        throw err;
    }
}

module.exports = {
  fetchCompanySettingsByVendorId
};