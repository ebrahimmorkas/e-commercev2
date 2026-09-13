const videoUploadService = require('../services/videoUploadService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// Every module (productVideo, bannerVideo, etc.) tells this controller which
// companyMaster fields govern its size/format/count rules via the request body.
// e.g. { module: 'productVideo', maxSizeField: 'allowedProductVideoMB', maxCountField: 'numberOfProductVideosAllowed' }

const uploadVideo = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { module, maxSizeField, allowedFormatsField, maxCountField } = req.body;

        const result = await videoUploadService.uploadVideo({
            vendorId,
            module,
            file: req.file,
            userId: req.user._id,
            maxSizeField,
            allowedFormatsField,
            maxCountField,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error uploading video', { vendorId, error });
    }
};

const getVideos = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { module } = req.query;

        const result = await videoUploadService.getVideos({ vendorId, module });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching videos', { vendorId, error });
    }
};

const getVideoById = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { videoId } = req.params;

        const result = await videoUploadService.getVideoById(videoId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching video', { vendorId, error });
    }
};

const updateVideo = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { videoId } = req.params;
        const { maxSizeField, allowedFormatsField } = req.body;

        const result = await videoUploadService.updateVideo({
            videoId,
            file: req.file,
            userId: req.user._id,
            maxSizeField,
            allowedFormatsField,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error updating video', { vendorId, error });
    }
};

const deleteVideo = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { videoId } = req.params;

        const result = await videoUploadService.deleteVideo({
            videoId,
            userId: req.user._id
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error deleting video', { vendorId, error });
    }
};

module.exports = {
    uploadVideo,
    getVideos,
    getVideoById,
    updateVideo,
    deleteVideo
};
