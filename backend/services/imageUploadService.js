const ImageAsset = require('../models/ImageAsset');
const { getProvider } = require('./providers/providerFactory');
const storageCredentialsService = require('./storageCredentialsService');
const { STORAGE_AREAS } = require('../constants/storageConstants');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { fileTypeFromBuffer } = require('file-type');

const MIME_EXTENSION_MAP = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/gif': ['gif']
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

    const allowedFormats = allowedFormatsField && companyMasterData ? companyMasterData[allowedFormatsField] : null;
    // An empty list means no format restriction - the format fields are lists
    // that default to [], and [] must not reject every upload.
    const allowedList = [].concat(allowedFormats || []).filter(Boolean);
    if (allowedList.length > 0) {
        const extension = getFileExtension(file.originalname);
        if (!allowedList.map(f => f.toLowerCase()).includes(extension)) {
            return { valid: false, message: `File format .${extension} is not allowed. Allowed formats: ${allowedList.join(', ')}.` };
        }
    }

    return { valid: true };
};

// Verifies the buffer's actual magic bytes match a real image AND match the claimed
// extension - catches corrupted files, renamed non-images, and zip-extracted junk
// BEFORE we spend an API call on a provider (Cloudinary/S3/R2).
const validateFileContent = async (file) => {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !detected.mime.startsWith('image/')) {
        return { valid: false, message: 'File is not a valid, readable image.' };
    }

    const extension = getFileExtension(file.originalname);
    const expectedExtensions = MIME_EXTENSION_MAP[detected.mime] || [];
    if (!expectedExtensions.includes(extension)) {
        return { valid: false, message: `File content does not match its .${extension} extension.` };
    }

    return { valid: true, detectedMime: detected.mime };
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

        const contentCheck = await validateFileContent(file);
        if (!contentCheck.valid) {
            return common.returnResult(false, 400, contentCheck.message);
        }
        const verifiedMimeType = contentCheck.detectedMime;

        if (maxCountField && companyMasterData && companyMasterData[maxCountField] != null) {
            const maxCount = companyMasterData[maxCountField];
            const existingCount = await ImageAsset.countDocuments({ vendorId, module, status: 'A' });
            if (existingCount >= maxCount) {
                return common.returnResult(false, 400, `Upload limit reached. Only ${maxCount} active image(s) allowed for ${module}.`);
            }
        }

        // Which provider + whose account (the vendor's own or the platform's).
        const target = await storageCredentialsService.resolveUploadTarget({ area: STORAGE_AREAS.IMAGE, vendorId, companyMasterData, websiteMasterData });
        if (!target.isSuccess) {
            return target;
        }
        const { provider: providerName, credentials, storageAccount } = target.meta;

        const provider = getProvider(providerName);
        const { url, key } = await provider.upload(file.buffer, {
            vendorId,
            module,
            originalName: file.originalname,
            mimeType: verifiedMimeType
        }, credentials);

        const imageAsset = await ImageAsset.create({
            vendorId,
            module,
            provider: providerName,
            url,
            key,
            storageAccount,
            originalName: file.originalname,
            mimeType: verifiedMimeType,
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

        const contentCheck = await validateFileContent(file);
        if (!contentCheck.valid) {
            return common.returnResult(false, 400, contentCheck.message);
        }
        const verifiedMimeType = contentCheck.detectedMime;

        // Re-resolve provider + account in case enforcement/vendor preference or
        // the vendor's account has changed since the last upload. Resolved
        // BEFORE the old file is removed, so a vendor whose account isn't set
        // up keeps their current image.
        const target = await storageCredentialsService.resolveUploadTarget({
            area: STORAGE_AREAS.IMAGE,
            vendorId: existingImage.vendorId,
            companyMasterData,
            websiteMasterData
        });
        if (!target.isSuccess) {
            return target;
        }
        const { provider: providerName, credentials, storageAccount } = target.meta;

        await storageCredentialsService.deleteStoredAsset({ area: STORAGE_AREAS.IMAGE, asset: existingImage, getProvider });

        const newProvider = getProvider(providerName);
        const { url, key } = await newProvider.upload(file.buffer, {
            vendorId: existingImage.vendorId,
            module: existingImage.module,
            originalName: file.originalname,
            mimeType: verifiedMimeType
        }, credentials);

        existingImage.provider = providerName;
        existingImage.url = url;
        existingImage.key = key;
        existingImage.storageAccount = storageAccount;
        existingImage.originalName = file.originalname;
        existingImage.mimeType = verifiedMimeType;
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

        await storageCredentialsService.deleteStoredAsset({ area: STORAGE_AREAS.IMAGE, asset: existingImage, getProvider });

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
    uploadImage,
    getImages,
    getImageById,
    updateImage,
    deleteImage
};