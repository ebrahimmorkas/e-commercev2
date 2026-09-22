const shippingPriceSettingsService = require('../services/shippingPriceSettingsService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// The rule arrays (categoryRules/countryRules/stateRules/cityRules) and
// weightUnit carry ids sourced from Category/CountryMaster/StateMaster/
// CityMaster/WeightMaster dropdowns, which now return common.encodeId-encoded
// ids - decode them here (only the field for the currently-selected method
// is ever present, per the Joi onlyFor() rules) before they reach the
// service, which expects raw ObjectIds for its existence checks and save.
const decodeShippingPricePayload = (body) => {
    const payload = { ...body };
    if (Array.isArray(payload.categoryRules)) {
        payload.categoryRules = payload.categoryRules.map((r) => ({ ...r, categoryId: common.decodeId(r.categoryId) }));
    }
    if (Array.isArray(payload.countryRules)) {
        payload.countryRules = payload.countryRules.map((r) => ({ ...r, countryId: common.decodeId(r.countryId) }));
    }
    if (Array.isArray(payload.stateRules)) {
        payload.stateRules = payload.stateRules.map((r) => ({ ...r, stateId: common.decodeId(r.stateId) }));
    }
    if (Array.isArray(payload.cityRules)) {
        payload.cityRules = payload.cityRules.map((r) => ({ ...r, cityId: common.decodeId(r.cityId) }));
    }
    if (payload.weightUnit) {
        payload.weightUnit = common.decodeId(payload.weightUnit);
    }
    return payload;
};

// Converts a ShippingPriceSettings mongoose doc into a response-safe object
// with every ObjectId field encoded via common.encodeId.
const formatShippingPriceSettingsForResponse = (settingsDoc) => {
    if (!settingsDoc) return settingsDoc;
    const settings = settingsDoc.toObject ? settingsDoc.toObject() : settingsDoc;

    return {
        ...settings,
        _id: settings._id ? common.encodeId(settings._id) : settings._id,
        vendorId: settings.vendorId ? common.encodeId(settings.vendorId) : settings.vendorId,
        categoryRules: (settings.categoryRules || []).map((r) => ({ ...r, categoryId: common.encodeId(r.categoryId) })),
        countryRules: (settings.countryRules || []).map((r) => ({ ...r, countryId: common.encodeId(r.countryId) })),
        stateRules: (settings.stateRules || []).map((r) => ({ ...r, stateId: common.encodeId(r.stateId) })),
        cityRules: (settings.cityRules || []).map((r) => ({ ...r, cityId: common.encodeId(r.cityId) })),
        weightUnit: settings.weightUnit ? common.encodeId(settings.weightUnit) : settings.weightUnit,
        createdBy: settings.createdBy ? {
            userID: settings.createdBy.userID ? common.encodeId(settings.createdBy.userID) : settings.createdBy.userID,
            vendorID: settings.createdBy.vendorID ? common.encodeId(settings.createdBy.vendorID) : settings.createdBy.vendorID,
        } : settings.createdBy,
        updatedBy: settings.updatedBy ? {
            userID: settings.updatedBy.userID ? common.encodeId(settings.updatedBy.userID) : settings.updatedBy.userID,
            vendorID: settings.updatedBy.vendorID ? common.encodeId(settings.updatedBy.vendorID) : settings.updatedBy.vendorID,
        } : settings.updatedBy,
    };
};

const createShippingPriceSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isShippingPriceFeatureOn', 'isShippingPriceFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const payload = decodeShippingPricePayload(req.body);
        const result = await shippingPriceSettingsService.createShippingPriceSettings(vendorId, req.user._id, payload, companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatShippingPriceSettingsForResponse(result.meta.settings));
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

        const payload = decodeShippingPricePayload(req.body);
        const result = await shippingPriceSettingsService.updateShippingPriceSettings(vendorId, req.user._id, payload, companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatShippingPriceSettingsForResponse(result.meta.settings));
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
        return common.sendSuccess(res, 200, 'Shipping price settings fetched successfully', formatShippingPriceSettingsForResponse(settings));
    } catch (error) {
        logger.logException('shippingPriceSettingsController: getShippingPriceSettings - Exception while fetching shipping price settings', { vendorId, error });
    }
};

module.exports = {
    createShippingPriceSettings,
    updateShippingPriceSettings,
    getShippingPriceSettings
};
