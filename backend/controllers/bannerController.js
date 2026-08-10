const bannerService = require('../services/bannerService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

const addBanner = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
                const companyMasterData = req.companyMasterData;
                const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
                if(!validiyResult.isSuccess) {
                    return common.sendError(res, validiyResult.statusCode, validiyResult.message)
                }

        const { numberOfBannersAllowed } = companyMasterData;
        const countResult = await bannerService.getBannerCount(vendorId);
        if(!countResult.meta.count == 0) {
            if (!countResult.isSuccess) {
                return common.sendError(res, countResult.statusCode, countResult.message);
            }
        }
        
        if (countResult.meta.count >= numberOfBannersAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of banners allowed');
        }

        const result = await bannerService.addBanner(vendorId, req.body, req.file, countResult.meta.count, req.user._id, companyMasterData, websiteMasterData);
        
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banner);

    } catch (error) {
        logger.logException('bannerController: addBanner - Exception while adding banner', { vendorId, error });
    }
};

const deleteBanner = async (req, res) => {
    const vendorId = req.vendorId;
    const { bannerId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const result = await bannerService.softDeleteBanner(vendorId, bannerId, req.user._id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('bannerController: deleteBanner - Exception while deleting banner', { vendorId, error });
    }
};

const updateBanner = async (req, res) => {
    const vendorId = req.vendorId;
    const { bannerId } = req.body;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const updateData = {
            ...req.body,
            isDefault: req.body.isDefault !== undefined ? req.body.isDefault === 'true' || req.body.isDefault === true : undefined
        };

        const result = await bannerService.updateBanner(vendorId, bannerId, updateData, req.file || null, req.user._id, companyMasterData, websiteMasterData);
        

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banner);
    } catch (error) {
        logger.logException('bannerController: updateBanner - Exception while updating banner', { vendorId, error });
    }
};

const getAllBanners = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }

        const companySettingsData = req.companySettingsData;
        if (!companySettingsData?.showAnnouncements) {
            return common.sendError(res, 403, websiteMasterData.featureDisabledMessageForClient);
        }
        const result = await redisService.getOrSet(
            redisKeys.banner(vendorId),
            async () => await bannerService.fetchAllActiveBanners(vendorId),
            3600
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banners);
    } catch (error) {
        logger.logException('bannerController: getAllBanners - Exception while fetching banners', { vendorId, error });
    }
};

const getAllBannersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const result = await bannerService.fetchAllBannersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banners);
    } catch (error) {
        logger.logException('bannerController: getAllBannersAdmin - Exception while fetching all banners for admin', { vendorId, error });
    }
};

const getBannerById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        const result = await bannerService.fetchBannerById(vendorId, id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banner);
    } catch (error) {
        logger.logException('bannerController: getBannerById - Exception while fetching banner by ID', { vendorId, error });
    }
};

module.exports = {
    addBanner,
    deleteBanner,
    updateBanner,
    getAllBanners,
    getAllBannersAdmin,
    getBannerById
};