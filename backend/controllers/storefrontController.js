const storefrontService = require('../services/storefrontService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const { THEME_CODES, FONT_FAMILIES, SECTION_TYPES } = require('../constants/storefrontConstants');

// Controllers must always respond - every catch sends a 500.
const fail = (res, label, vendorId, error) => {
    logger.logException(`storefrontController: ${label}`, { vendorId, error });
    return common.sendError(res, 500, 'Something went wrong');
};

// Public. Published config only; cached per vendor. The storefront falls back to
// the default look on any error, so this never blocks the page.
const getStorefrontConfig = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await redisService.getOrSet(
            redisKeys.storefrontConfig(vendorId),
            async () => await storefrontService.getPublishedConfig(vendorId),
            3600
        );
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, 200, result.message, result.meta.config);
    } catch (error) {
        return fail(res, 'getStorefrontConfig', vendorId, error);
    }
};

const getAdminSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await storefrontService.getAdminView(vendorId);
        return common.sendSuccess(res, 200, result.message, {
            ...result.meta,
            options: { themes: THEME_CODES, fonts: FONT_FAMILIES, sectionTypes: SECTION_TYPES },
        });
    } catch (error) {
        return fail(res, 'getAdminSettings', vendorId, error);
    }
};

const saveDraft = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await storefrontService.saveDraft(vendorId, req.user._id, req.body);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, 200, result.message, result.meta.draft);
    } catch (error) {
        return fail(res, 'saveDraft', vendorId, error);
    }
};

const publish = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await storefrontService.publish(vendorId, req.user._id);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, 200, result.message, result.meta.published);
    } catch (error) {
        return fail(res, 'publish', vendorId, error);
    }
};

const discardDraft = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await storefrontService.discardDraft(vendorId, req.user._id);
        return common.sendSuccess(res, 200, result.message, result.meta.draft);
    } catch (error) {
        return fail(res, 'discardDraft', vendorId, error);
    }
};

module.exports = { getStorefrontConfig, getAdminSettings, saveDraft, publish, discardDraft };
