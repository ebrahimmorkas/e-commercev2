const shippingPriceSettingsService = require('../services/shippingPriceSettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const createShippingPriceSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isShippingPriceFeatureOn', 'isShippingPriceFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await shippingPriceSettingsService.createShippingPriceSettings(vendorId, req.user._id, req.body, companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
    } catch (error) {
        logger.logException('shippingPriceSettingsController: createShippingPriceSettings - Exception while creating shipping price settings', { vendorId, error });
    }
};

const updateShippingPriceSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isShippingPriceFeatureOn', 'isShippingPriceFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await shippingPriceSettingsService.updateShippingPriceSettings(vendorId, req.user._id, req.body, companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.settings);
    } catch (error) {
        logger.logException('shippingPriceSettingsController: updateShippingPriceSettings - Exception while updating shipping price settings', { vendorId, error });
    }
};

const getShippingPriceSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const settings = await shippingPriceSettingsService.fetchShippingPriceSettingsByVendorId(vendorId);
        if (!settings) {
            return common.sendError(res, 404, 'Shipping price settings not found');
        }
        return common.sendSuccess(res, 200, 'Shipping price settings fetched successfully', settings);
    } catch (error) {
        logger.logException('shippingPriceSettingsController: getShippingPriceSettings - Exception while fetching shipping price settings', { vendorId, error });
    }
};

module.exports = {
    createShippingPriceSettings,
    updateShippingPriceSettings,
    getShippingPriceSettings
};
