const imageUploadService = require('../services/imageUploadService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// Every module (banner, category, companyLogo, etc.) tells this controller which
// companyMaster fields govern its size/format/count rules via the request body.
// e.g. { module: 'banner', maxSizeField: 'allowedBannerMB', maxCountField: 'numberOfBannersAllowed' }

const uploadImage = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { module, maxSizeField, allowedFormatsField, maxCountField } = req.body;

        const result = await imageUploadService.uploadImage({
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
        logger.logException('Error uploading image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to upload image');
    }
};

const getImages = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { module } = req.query;

        const result = await imageUploadService.getImages({ vendorId, module });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching images', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch images');
    }
};

const getImageById = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { imageId } = req.params;

        const result = await imageUploadService.getImageById(imageId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch image');
    }
};

const updateImage = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { imageId } = req.params;
        const { maxSizeField, allowedFormatsField } = req.body;

        const result = await imageUploadService.updateImage({
            imageId,
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
        logger.logException('Error updating image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update image');
    }
};

const deleteImage = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const { imageId } = req.params;

        const result = await imageUploadService.deleteImage({
            imageId,
            userId: req.user._id
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error deleting image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to delete image');
    }
};

module.exports = {
    uploadImage,
    getImages,
    getImageById,
    updateImage,
    deleteImage
};