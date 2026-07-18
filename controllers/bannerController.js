const bannerService = require('../services/bannerService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

const addBanner = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        if (!websiteMasterData?.isBannerFeatureOn) {
            return common.sendError(res, 403, 'This feature is temporarily off');
        }

        const companyMasterData = req.companyMasterData;
        if (!companyMasterData?.isBannerFeatureOn) {
            return common.sendError(res, 403, 'This feature is disabled in your plan');
        }

        const { numberOfBannersAllowed } = companyMasterData;
        const existingCount = await bannerService.getBannerCount(vendorId);
        if (existingCount >= numberOfBannersAllowed) {
            return common.sendError(res, 403, 'You have exceeded the number of banners allowed');
        }

        const imagePath = req.file.path;
        const banner = await bannerService.addBanner(vendorId, req.body, imagePath, existingCount);
        return common.sendSuccess(res, 201, 'Banner added successfully', banner);

    } catch (error) {
        logger.logException('bannerController: addBanner - Exception while adding banner', { vendorId, error });
        return common.sendError(res, 500, 'Failed to add banner');
    }
};

const deleteBanner = async (req, res) => {
    const vendorId = req.vendorId;
    const { banner_id } = req.body;
    try {
        const result = await bannerService.softDeleteBanner(vendorId, banner_id);

        if (result.notFound) {
            return common.sendError(res, 404, 'Banner not found');
        }

        return common.sendSuccess(res, 200, 'Banner deleted successfully');
    } catch (error) {
        logger.logException('bannerController: deleteBanner - Exception while deleting banner', { vendorId, error });
        return common.sendError(res, 500, 'Failed to delete banner');
    }
};

const updateBanner = async (req, res) => {
    const vendorId = req.vendorId;
    const { banner_id } = req.body;
    try {
        const newImagePath = req.file ? req.file.path : null;

        // Parse boolean fields coming from multipart/form-data as strings
        const updateData = {
            ...req.body,
            isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : undefined,
            isDefault: req.body.isDefault !== undefined ? req.body.isDefault === 'true' || req.body.isDefault === true : undefined
        };

        const updated = await bannerService.updateBanner(vendorId, banner_id, updateData, newImagePath);

        if (!updated) {
            return common.sendError(res, 404, 'Banner not found');
        }

        return common.sendSuccess(res, 200, 'Banner updated successfully', updated);
    } catch (error) {
        logger.logException('bannerController: updateBanner - Exception while updating banner', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update banner');
    }
};

const getAllBanners = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const banners = await redisService.getOrSet(
            redisKeys.banner(vendorId),
            async () => await bannerService.fetchAllActiveBanners(vendorId),
            3600
        );
        return common.sendSuccess(res, 200, 'Banners fetched successfully', banners);
    } catch (error) {
        logger.logException('bannerController: getAllBanners - Exception while fetching banners', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch banners');
    }
};

const getAllBannersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const banners = await bannerService.fetchAllBannersAdmin(vendorId);
        return common.sendSuccess(res, 200, 'Banners fetched successfully', banners);
    } catch (error) {
        logger.logException('bannerController: getAllBannersAdmin - Exception while fetching all banners for admin', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch banners');
    }
};

const getBannerById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const banner = await bannerService.fetchBannerById(vendorId, id);

        if (!banner) {
            return common.sendError(res, 404, 'Banner not found');
        }

        return common.sendSuccess(res, 200, 'Banner fetched successfully', banner);
    } catch (error) {
        logger.logException('bannerController: getBannerById - Exception while fetching banner by ID', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch banner');
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