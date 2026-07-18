const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
// const companySettingsService = require('../services/companySettingsService');
const companyMasterService = require('../services/companyMasterService');
const websiteMasterService = require('../services/websiteMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const ensureVendorDataCached = async (req, res, next) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            logger.logInfo(`Vendor ID not found`);
            return common.sendError(res, 400, `Vendor identification failed`);
        }

        // const companySettings = await redisService.getOrSet(
        //     redisKeys.companySettings(vendorId),
        //     async () => await companySettingsService.fetchCompanySettingsByVendorId(vendorId),
        //     3600
        // );

        const websiteMasterData = await redisService.getOrSet(
            redisKeys.websiteMaster(),
            async () => await websiteMasterService.fetchWebsiteMasterData(),
            3600
        );

        console.log(`ensureVendorDataCached - End of fetching data either from DB or Redis ${websiteMasterData}`);

        const companyMasterData = await redisService.getOrSet(
            redisKeys.companyMaster(vendorId),
            async () => await companyMasterService.fetchCompanyMasterByVendorId(vendorId),
            3600
        );

        // console.log(`ensureVendorDataCached middleware ${companyMasterData}`);

        if (!companyMasterData) {
            return common.sendError(res, 500, `Failed to load vendor configuration`);
        }

        // req.companySettings = companySettings;
        req.websiteMasterData = websiteMasterData;
        req.companyMasterData = companyMasterData;
        next();

    } catch (error) {
        logger.logException("Exception in ensuredVendorDataCached middleware", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load vendor configuration'
        });
    }
};

module.exports = ensureVendorDataCached;