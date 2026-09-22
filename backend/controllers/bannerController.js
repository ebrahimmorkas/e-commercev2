const bannerService = require('../services/bannerService');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts a Banner mongoose doc into a response-safe object with every
// ObjectId field encoded via common.encodeId.
const formatBannerForResponse = (bannerDoc) => {
    if (!bannerDoc) return bannerDoc;
    const banner = bannerDoc.toObject ? bannerDoc.toObject() : bannerDoc;

    return {
        ...banner,
        _id: banner._id ? common.encodeId(banner._id) : banner._id,
        vendorId: banner.vendorId ? common.encodeId(banner.vendorId) : banner.vendorId,
        imageAssetId: banner.imageAssetId ? common.encodeId(banner.imageAssetId) : banner.imageAssetId,
        videoAssetId: banner.videoAssetId ? common.encodeId(banner.videoAssetId) : banner.videoAssetId,
        createdBy: banner.createdBy ? common.encodeId(banner.createdBy) : banner.createdBy,
        updatedBy: banner.updatedBy ? common.encodeId(banner.updatedBy) : banner.updatedBy,
        deletedBy: banner.deletedBy ? common.encodeId(banner.deletedBy) : banner.deletedBy,
        activeMarkedBy: banner.activeMarkedBy ? common.encodeId(banner.activeMarkedBy) : banner.activeMarkedBy,
        inActiveMarkedBy: banner.inActiveMarkedBy ? common.encodeId(banner.inActiveMarkedBy) : banner.inActiveMarkedBy,
    };
};

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

        const imageFile = req.files?.image?.[0] || null;
        const videoFile = req.files?.video?.[0] || null;

        const result = await bannerService.addBanner(vendorId, req.body, imageFile, videoFile, countResult.meta.count, req.user._id, companyMasterData, websiteMasterData);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatBannerForResponse(result.meta.banner));

    } catch (error) {
        logger.logException('bannerController: addBanner - Exception while adding banner', { vendorId, error });
    }
};

const deleteBanner = async (req, res) => {
    const vendorId = req.vendorId;
    // Already decoded to a raw ObjectId by validateDeleteBanner (which needs
    // it raw for its own mongoose.Types.ObjectId check) - don't decode again.
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
    // Already decoded to a raw ObjectId by validateUpdateBanner (which needs
    // it raw for its own Banner.findOne lookup) - don't decode again.
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
        delete updateData.bannerId;

        const imageFile = req.files?.image?.[0] || null;
        const videoFile = req.files?.video?.[0] || null;

        const result = await bannerService.updateBanner(vendorId, bannerId, updateData, imageFile, videoFile, req.user._id, companyMasterData, websiteMasterData);


        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatBannerForResponse(result.meta.banner));
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

        // Vendor's own show/hide toggle (CompanySettings.showBanners) -
        // distinct from the isBannerFeatureOn entitlement checked above. Not
        // an error condition, just "nothing to show" - same convention as
        // showAnnouncements/showReviewsToCustomers (see CompanySettings.js).
        const companySettingsData = req.companySettingsData;
        if (companySettingsData && companySettingsData.showBanners === false) {
            return common.sendSuccess(res, 200, 'Banners are disabled for this store', []);
        }

        const result = await redisService.getOrSet(
            redisKeys.banner(vendorId),
            async () => await bannerService.fetchAllActiveBanners(vendorId),
            3600
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banners.map(formatBannerForResponse));
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.banners.map(formatBannerForResponse));
    } catch (error) {
        logger.logException('bannerController: getAllBannersAdmin - Exception while fetching all banners for admin', { vendorId, error });
    }
};

const getBannerById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validiyResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, "isBannerFeatureOn", "isBannerFeatureOn");
        if(!validiyResult.isSuccess) {
            return common.sendError(res, validiyResult.statusCode, validiyResult.message)
        }
        id = common.decodeId(req.params.id);
        const result = await bannerService.fetchBannerById(vendorId, id);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatBannerForResponse(result.meta.banner));
    } catch (error) {
        logger.logException('bannerController: getBannerById - Exception while fetching banner by ID', { vendorId, error });
    }
};

const bulkSetBannerStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { status } = req.body;
    try {
        const decodedIds = req.body.bannerIds.map((id) => common.decodeId(id));
        const result = await bannerService.bulkSetBannerStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('bannerController: bulkSetBannerStatus - Exception while bulk updating banner status', { vendorId, error });
    }
};

const bulkDeleteBanners = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.bannerIds.map((id) => common.decodeId(id));
        const result = await bannerService.bulkDeleteBanners(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('bannerController: bulkDeleteBanners - Exception while bulk deleting banners', { vendorId, error });
    }
};

module.exports = {
    addBanner,
    deleteBanner,
    updateBanner,
    getAllBanners,
    getAllBannersAdmin,
    getBannerById,
    bulkSetBannerStatus,
    bulkDeleteBanners
};