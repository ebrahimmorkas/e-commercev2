const VideoAsset = require('../models/VideoAsset');
const { getProvider } = require('./providers/videoProviderFactory');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { fileTypeFromFile } = require('file-type');
const fs = require('fs/promises');

// Verified empirically against file-type's actual detector output (not guessed from
// "standard" MIME names) - several of these differ from what you'd expect:
// m4v is 'video/x-m4v' (not video/mp4), mkv is 'video/matroska' (no 'x-' prefix),
// avi is 'video/vnd.avi' (not video/x-msvideo). mpeg/mpg are deliberately excluded:
// file-type detects legacy MPEG-PS as 'video/MP1S'/'video/MP2P', which don't map
// cleanly to a single extension check and are obscure enough not to be worth supporting.
const MIME_EXTENSION_MAP = {
    'video/mp4': ['mp4'],
    'video/x-m4v': ['m4v'],
    'video/quicktime': ['mov'],
    'video/webm': ['webm'],
    'video/matroska': ['mkv'],
    'video/vnd.avi': ['avi']
};

// Resolves which provider a vendor's upload should go to right now.
// enforceMainVideoService=true always wins with mainVideoService.
// Otherwise vendor's own videoService is used, falling back to mainVideoService if unset.
const resolveVideoProvider = (companyMasterData, websiteMasterData) => {
    if (websiteMasterData && websiteMasterData.enforceMainVideoService === true) {
        return websiteMasterData.mainVideoService;
    }
    return (companyMasterData && companyMasterData.videoService) || (websiteMasterData && websiteMasterData.mainVideoService);
};

// Hard ceiling (MB) used only when neither WebsiteMaster nor CompanyMaster
// configures a maxVideoSize - i.e. nothing is misconfigured, there's just no
// explicit cap set anywhere yet.
const DEFAULT_MAX_VIDEO_SIZE_MB = 500;

// Resolves the multer upload ceiling (MB) for a request. WebsiteMaster.maxVideoSize
// is a global override: whenever it holds a real value it always wins, same as
// enforceMainVideoService/mainVideoService overriding the vendor's own provider
// choice. null/0 there means "no site-wide override" and falls back to the
// vendor's own CompanyMaster.maxVideoSize, then to the hard default.
const resolveMaxVideoSizeMB = (companyMasterData, websiteMasterData) => {
    const websiteMax = websiteMasterData && websiteMasterData.maxVideoSize;
    if (websiteMax) return websiteMax;

    const companyMax = companyMasterData && companyMasterData.maxVideoSize;
    if (companyMax) return companyMax;

    return DEFAULT_MAX_VIDEO_SIZE_MB;
};

// Extensions used only when neither WebsiteMaster nor CompanyMaster configures
// an allowedVideoFormat - i.e. nothing is misconfigured, there's just no
// explicit list set anywhere yet.
const DEFAULT_ALLOWED_VIDEO_FORMATS = ['mp4'];

// Resolves the allowed video extensions for a request. WebsiteMaster.allowedVideoFormat
// is a global override: whenever it's a non-empty list it always wins, same as
// resolveMaxVideoSizeMB. An empty list there means "no site-wide override" and
// falls back to the vendor's own CompanyMaster.allowedVideoFormat, then to the
// hard default.
const resolveAllowedVideoFormats = (companyMasterData, websiteMasterData) => {
    const websiteFormats = websiteMasterData && websiteMasterData.allowedVideoFormat;
    if (Array.isArray(websiteFormats) && websiteFormats.length > 0) return websiteFormats;

    const companyFormats = companyMasterData && companyMasterData.allowedVideoFormat;
    if (Array.isArray(companyFormats) && companyFormats.length > 0) return companyFormats;

    return DEFAULT_ALLOWED_VIDEO_FORMATS;
};

const getFileExtension = (originalName = '') => {
    const parts = originalName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

// Validates file size and format against fields on companyMasterData, looked up by field name.
// This keeps the service generic - callers pass which field to check rather than hardcoded values,
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

// Verifies the file's actual magic bytes match a real video AND match the claimed
// extension - catches corrupted files, renamed non-videos, and zip-extracted junk
// BEFORE we spend an upload call on a provider (Cloudinary/S3/R2). Reads from disk
// (not a buffer) since videos arrive via multer.diskStorage, not memoryStorage.
const validateFileContent = async (file) => {
    const detected = await fileTypeFromFile(file.path);
    if (!detected || !detected.mime.startsWith('video/')) {
        return { valid: false, message: 'File is not a valid, readable video.' };
    }

    const extension = getFileExtension(file.originalname);
    const expectedExtensions = MIME_EXTENSION_MAP[detected.mime] || [];
    if (!expectedExtensions.includes(extension)) {
        return { valid: false, message: `File content does not match its .${extension} extension.` };
    }

    return { valid: true, detectedMime: detected.mime };
};

// Deletes the multer temp file - best-effort, called once the file has been
// handed off to a provider (or the upload failed) so temp files never pile up.
// A missing file is expected (localVideoProvider already moved it away) and not an error.
const cleanupTempFile = async (filePath) => {
    try {
        if (filePath) await fs.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') logger.logException('videoUploadService - cleanupTempFile: Exception while deleting temp file', err);
    }
};

const uploadVideo = async ({
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

        try {
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
                const existingCount = await VideoAsset.countDocuments({ vendorId, module, status: 'A' });
                if (existingCount >= maxCount) {
                    return common.returnResult(false, 400, `Upload limit reached. Only ${maxCount} active video(s) allowed for ${module}.`);
                }
            }

            const providerName = resolveVideoProvider(companyMasterData, websiteMasterData);
            if (!providerName) {
                return common.returnResult(false, 400, 'No video storage provider configured for this vendor.');
            }

            const provider = getProvider(providerName);
            const { url, key } = await provider.upload(file.path, {
                vendorId,
                module,
                originalName: file.originalname,
                mimeType: verifiedMimeType
            });

            const videoAsset = await VideoAsset.create({
                vendorId,
                module,
                provider: providerName,
                url,
                key,
                originalName: file.originalname,
                mimeType: verifiedMimeType,
                size: file.size,
                status: 'A',
                createdBy: userId
            });

            logger.logInfo(1, 0, 'Video uploaded successfully', { vendorId, module, provider: providerName });

            return common.returnResult(true, 201, 'Video uploaded successfully', { video: videoAsset });
        } finally {
            await cleanupTempFile(file.path);
        }
    } catch (err) {
        throw err;
    }
};

const getVideos = async ({ vendorId, module, activeOnly = true }) => {
    try {
        const filter = { vendorId, module };
        if (activeOnly) filter.status = 'A';

        const videos = await VideoAsset.find(filter).sort({ createdAt: -1 });

        return common.returnResult(true, 200, 'Videos fetched successfully', { videos });
    } catch (err) {
        throw err;
    }
};

const getVideoById = async (videoId) => {
    try {
        const video = await VideoAsset.findById(videoId);
        if (!video) {
            return common.returnResult(false, 404, 'Video not found.');
        }

        return common.returnResult(true, 200, 'Video fetched successfully', { video });
    } catch (err) {
        throw err;
    }
};

const updateVideo = async ({
    videoId,
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

        try {
            const existingVideo = await VideoAsset.findById(videoId);
            if (!existingVideo) {
                return common.returnResult(false, 404, 'Video not found.');
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

            // Re-resolve provider in case enforcement/vendor preference has changed since the last upload.
            const providerName = resolveVideoProvider(companyMasterData, websiteMasterData);
            if (!providerName) {
                return common.returnResult(false, 400, 'No video storage provider configured for this vendor.');
            }

            const oldProvider = getProvider(existingVideo.provider);
            await oldProvider.delete(existingVideo.key);

            const newProvider = getProvider(providerName);
            const { url, key } = await newProvider.upload(file.path, {
                vendorId: existingVideo.vendorId,
                module: existingVideo.module,
                originalName: file.originalname,
                mimeType: verifiedMimeType
            });

            existingVideo.provider = providerName;
            existingVideo.url = url;
            existingVideo.key = key;
            existingVideo.originalName = file.originalname;
            existingVideo.mimeType = verifiedMimeType;
            existingVideo.size = file.size;
            existingVideo.updatedBy = userId;

            await existingVideo.save();

            logger.logInfo(1, 0, 'Video replaced successfully', { videoId, provider: providerName });

            return common.returnResult(true, 200, 'Video updated successfully', { video: existingVideo });
        } finally {
            await cleanupTempFile(file.path);
        }
    } catch (err) {
        throw err;
    }
};

const deleteVideo = async ({ videoId, userId }) => {
    try {
        const existingVideo = await VideoAsset.findById(videoId);
        if (!existingVideo) {
            return common.returnResult(false, 404, 'Video not found.');
        }

        const provider = getProvider(existingVideo.provider);
        await provider.delete(existingVideo.key);

        existingVideo.status = 'D';
        existingVideo.deletedBy = userId;
        await existingVideo.save();

        logger.logInfo(1, 0, 'Video deleted successfully', { videoId });

        return common.returnResult(true, 200, 'Video deleted successfully');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveVideoProvider,
    resolveMaxVideoSizeMB,
    resolveAllowedVideoFormats,
    getFileExtension,
    uploadVideo,
    getVideos,
    getVideoById,
    updateVideo,
    deleteVideo
};
