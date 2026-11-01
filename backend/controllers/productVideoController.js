const productVideoService = require('../services/productVideoService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Product videos - see services/productVideoService.js. Ids go out and come in
// common.encodeId-encoded, like every other product id.

// GET /products/product-video-settings - switch + limits the admin form shows.
const getProductVideoSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await productVideoService.getProductVideoSettings(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('productVideoController: getProductVideoSettings - Exception while fetching product video settings', { vendorId, error });
    }
};

// POST /products/upload-product-video - one video (multipart field "video").
const uploadProductVideo = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        if (!req.file) {
            return common.sendError(res, 400, 'Validation failed', [{ field: 'video', message: 'Video file is required.' }]);
        }

        const result = await productVideoService.uploadProductVideo({
            vendorId,
            userId: req.user._id,
            file: req.file,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData
        });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const { video } = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, {
            video: { ...video, videoAssetId: common.encodeId(video.videoAssetId) }
        });
    } catch (error) {
        logger.logException('productVideoController: uploadProductVideo - Exception while uploading a product video', { vendorId, error });
    }
};

// DELETE /products/product-video/:videoId - an uploaded video the form never saved.
const discardProductVideo = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const videoAssetId = common.tryDecodeId(req.params.videoId);
        if (!videoAssetId) {
            return common.sendError(res, 400, 'Validation failed', [{ field: 'videoId', message: 'Video ID is invalid.' }]);
        }

        const result = await productVideoService.discardProductVideo({ vendorId, userId: req.user._id, videoAssetId });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('productVideoController: discardProductVideo - Exception while removing a product video', { vendorId, error });
    }
};

module.exports = {
    getProductVideoSettings,
    uploadProductVideo,
    discardProductVideo
};
