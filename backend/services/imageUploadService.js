const ImageAsset = require('../models/ImageAsset');
const { getProvider } = require('./providers/providerFactory');
const common = require('../utils/common');
const logger = require('../utils/logger');

// Resolves which provider a vendor's upload should go to right now.
// enforceMainImageService=true always wins with mainImageService.
// Otherwise vendor's own imageService is used, falling back to mainImageService if unset.
const resolveImageProvider = (companyMasterData, websiteMasterData) => {
    if (websiteMasterData && websiteMasterData.enforceMainImageService === true) {
        return websiteMasterData.mainImageService;
    }
    return (companyMasterData && companyMasterData.imageService) || (websiteMasterData && websiteMasterData.mainImageService);
};

const getFileExtension = (originalName = '') => {
    const parts = originalName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

// Validates file size and format against fields on companyMasterData, looked up by field name.
// This keeps the service generic — callers pass which field to check rather than hardcoded values,
// so new modules can be supported without changing this service.
const validateFile = (file, { maxSizeField, allowedFormatsField }, companyMasterData) => {
    if (maxSizeField && companyMasterData && companyMasterData[maxSizeField] != null) {
        const maxSizeMB = companyMasterData[maxSizeField];
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return { valid: false, message: `File size exceeds the allowed limit of ${maxSizeMB}MB.` };
        }
    }

    if (allowedFormatsField && companyMasterData && companyMasterData[allowedFormatsField]) {
        const allowedFormats = companyMasterData[allowedFormatsField];
        const allowedList = Array.isArray(allowedFormats) ? allowedFormats : [allowedFormats];
        const extension = getFileExtension(file.originalname);
        if (!allowedList.map(f => f.toLowerCase()).includes(extension)) {
            return { valid: false, message: `File format .${extension} is not allowed. Allowed formats: ${allowedList.join(', ')}.` };
        }
    }

    return { valid: true };
};

const uploadImage = async ({
    vendorId,
    module,
    file,
    userId,
    maxSizeField,
    allowedFormatsField,
    maxCountField,
    companyMasterData,
    websiteMasterData
}) => {
    try {
        if (!file) {
            return common.returnResult(false, 400, 'File is required.');
        }

        const validation = validateFile(file, { maxSizeField, allowedFormatsField }, companyMasterData);
        if (!validation.valid) {
            return common.returnResult(false, 400, validation.message);
        }

        if (maxCountField && companyMasterData && companyMasterData[maxCountField] != null) {
            const maxCount = companyMasterData[maxCountField];
            const existingCount = await ImageAsset.countDocuments({ vendorId, module, status: 'A' });
            if (existingCount >= maxCount) {
                return common.returnResult(false, 400, `Upload limit reached. Only ${maxCount} active image(s) allowed for ${module}.`);
            }
        }

        const providerName = resolveImageProvider(companyMasterData, websiteMasterData);
        if (!providerName) {
            return common.returnResult(false, 400, 'No image storage provider configured for this vendor.');
        }

        const provider = getProvider(providerName);
        const { url, key } = await provider.upload(file.buffer, {
            vendorId,
            module,
            originalName: file.originalname,
            mimeType: file.mimetype
        });

        const imageAsset = await ImageAsset.create({
            vendorId,
            module,
            provider: providerName,
            url,
            key,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            status: 'A',
            createdBy: userId
        });

        logger.logInfo(1, 0, 'Image uploaded successfully', { vendorId, module, provider: providerName });

        return common.returnResult(true, 201, 'Image uploaded successfully', { image: imageAsset });
    } catch (err) {
        throw err;
    }
};

const getImages = async ({ vendorId, module, activeOnly = true }) => {
    try {
        const filter = { vendorId, module };
        if (activeOnly) filter.status = 'A';

        const images = await ImageAsset.find(filter).sort({ createdAt: -1 });

        return common.returnResult(true, 200, 'Images fetched successfully', { images });
    } catch (err) {
        throw err;
    }
};

const getImageById = async (imageId) => {
    try {
        const image = await ImageAsset.findById(imageId);
        if (!image) {
            return common.returnResult(false, 404, 'Image not found.');
        }

        return common.returnResult(true, 200, 'Image fetched successfully', { image });
    } catch (err) {
        throw err;
    }
};

const updateImage = async ({
    imageId,
    file,
    userId,
    maxSizeField,
    allowedFormatsField,
    companyMasterData,
    websiteMasterData
}) => {
    try {
        if (!file) {
            return common.returnResult(false, 400, 'File is required.');
        }

        const existingImage = await ImageAsset.findById(imageId);
        if (!existingImage) {
            return common.returnResult(false, 404, 'Image not found.');
        }

        const validation = validateFile(file, { maxSizeField, allowedFormatsField }, companyMasterData);
        if (!validation.valid) {
            return common.returnResult(false, 400, validation.message);
        }

        // Re-resolve provider in case enforcement/vendor preference has changed since the last upload.
        const providerName = resolveImageProvider(companyMasterData, websiteMasterData);
        if (!providerName) {
            return common.returnResult(false, 400, 'No image storage provider configured for this vendor.');
        }

        const oldProvider = getProvider(existingImage.provider);
        await oldProvider.delete(existingImage.key);

        const newProvider = getProvider(providerName);
        const { url, key } = await newProvider.upload(file.buffer, {
            vendorId: existingImage.vendorId,
            module: existingImage.module,
            originalName: file.originalname,
            mimeType: file.mimetype
        });

        existingImage.provider = providerName;
        existingImage.url = url;
        existingImage.key = key;
        existingImage.originalName = file.originalname;
        existingImage.mimeType = file.mimetype;
        existingImage.size = file.size;
        existingImage.updatedBy = userId;

        await existingImage.save();

        logger.logInfo(1, 0, 'Image replaced successfully', { imageId, provider: providerName });

        return common.returnResult(true, 200, 'Image updated successfully', { image: existingImage });
    } catch (err) {
        throw err;
    }
};

const deleteImage = async ({ imageId, userId }) => {
    try {
        const existingImage = await ImageAsset.findById(imageId);
        if (!existingImage) {
            return common.returnResult(false, 404, 'Image not found.');
        }

        const provider = getProvider(existingImage.provider);
        await provider.delete(existingImage.key);

        existingImage.status = 'D';
        existingImage.deletedBy = userId;
        await existingImage.save();

        logger.logInfo(1, 0, 'Image deleted successfully', { imageId });

        return common.returnResult(true, 200, 'Image deleted successfully');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveImageProvider,
    uploadImage,
    getImages,
    getImageById,
    updateImage,
    deleteImage
};