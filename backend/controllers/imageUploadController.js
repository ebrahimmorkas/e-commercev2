const imageUploadService = require('../services/imageUploadService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// Converts an ImageAsset mongoose doc into a response-safe object with every
// ObjectId field encoded. This endpoint's own _id is what every other
// module (banner/category/product/companySettings) receives back and later
// re-submits as that module's imageAssetId - those modules now decode
// incoming imageAssetId values, so this MUST return an encoded id or every
// "upload then attach" flow breaks.
const formatImageForResponse = (imageDoc) => {
    if (!imageDoc) return imageDoc;
    const image = imageDoc.toObject ? imageDoc.toObject() : imageDoc;

    return {
        ...image,
        _id: image._id ? common.encodeId(image._id) : image._id,
        vendorId: image.vendorId ? common.encodeId(image.vendorId) : image.vendorId,
        createdBy: image.createdBy ? common.encodeId(image.createdBy) : image.createdBy,
        updatedBy: image.updatedBy ? common.encodeId(image.updatedBy) : image.updatedBy,
        deletedBy: image.deletedBy ? common.encodeId(image.deletedBy) : image.deletedBy,
        activeMarkedBy: image.activeMarkedBy ? common.encodeId(image.activeMarkedBy) : image.activeMarkedBy,
        inActiveMarkedBy: image.inActiveMarkedBy ? common.encodeId(image.inActiveMarkedBy) : image.inActiveMarkedBy,
    };
};

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
        return common.sendSuccess(res, result.statusCode, result.message, { image: formatImageForResponse(result.meta.image) });
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
        return common.sendSuccess(res, result.statusCode, result.message, { images: result.meta.images.map(formatImageForResponse) });
    } catch (error) {
        logger.logException('Error fetching images', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch images');
    }
};

const getImageById = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const imageId = common.decodeId(req.params.imageId);

        const result = await imageUploadService.getImageById(imageId);

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { image: formatImageForResponse(result.meta.image) });
    } catch (error) {
        logger.logException('Error fetching image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch image');
    }
};

const updateImage = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const imageId = common.decodeId(req.params.imageId);
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
        return common.sendSuccess(res, result.statusCode, result.message, { image: formatImageForResponse(result.meta.image) });
    } catch (error) {
        logger.logException('Error updating image', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update image');
    }
};

const deleteImage = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const imageId = common.decodeId(req.params.imageId);

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