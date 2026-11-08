const fieldConfigService = require('../services/fieldConfigService');
const logger = require('../utils/logger');

// Puts the vendor's field configuration on req.fieldConfigData and replaces
// req.companySettingsData with a copy in which every setting a hidden field
// forces is applied (e.g. a hidden product code is always auto-generated) -
// see fieldConfigService.applyHiddenFieldSettings. Mount AFTER
// ensureVendorDataCached.
const loadVendorFieldConfig = async (req, res, next) => {
    try {
        const fieldConfigData = await fieldConfigService.getVendorFieldConfig(req.vendorId);
        req.fieldConfigData = fieldConfigData;
        req.companySettingsData = fieldConfigService.applyHiddenFieldSettings(req.companySettingsData, fieldConfigData);
        next();
    } catch (error) {
        // Answers the request with a 500 + error reference itself.
        logger.logException('Exception in loadVendorFieldConfig middleware', { vendorId: req.vendorId, error });
    }
};

module.exports = loadVendorFieldConfig;
