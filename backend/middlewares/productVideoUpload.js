const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { resolveAllowedVideoFormats, getFileExtension, cleanupTempFile } = require('../services/videoUploadService');
const productVideoService = require('../services/productVideoService');
const { PRODUCT_VIDEO_FIELD_NAME } = require('../constants/productVideoConstants');
const common = require('../utils/common');
const logger = require('../utils/logger');

// One product video (multipart field "video") -> a temp file on disk, the same
// way videoUpload.js does it (videos are never held in memory). Differences:
//  - the feature switch is checked BEFORE anything is written, so a store
//    without product videos never receives the bytes;
//  - the size ceiling is the PRODUCT limit (productVideoService.
//    resolveProductVideoMaxSizeMB): sizeOfVideoUploadAllowedInProduct capped by
//    WebsiteMaster.maxVideoSize. null there = no ceiling at all - deliberately
//    no fallback to CompanyMaster.maxVideoSize or a default.
// Needs ensureVendorDataCached earlier in the chain.
const tempDir = path.join(os.tmpdir(), 'video-uploads');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${path.basename(file.originalname)}`)
});

const productVideoUpload = async (req, res, next) => {
    try {
        const featureCheck = await productVideoService.checkProductVideoFeature(req.vendorId, req.websiteMasterData, req.companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.sendError(res, featureCheck.statusCode, featureCheck.message);
        }

        const maxSizeMB = productVideoService.resolveProductVideoMaxSizeMB(req.companyMasterData, req.websiteMasterData);
        const allowedFormats = resolveAllowedVideoFormats(req.companyMasterData, req.websiteMasterData)
            .map((format) => String(format).toLowerCase());

        // busboy compares the byte count with strict equality, so the limit
        // must be a whole number (see videoUpload.js).
        const limits = { files: 1 };
        if (maxSizeMB !== null) limits.fileSize = Math.floor(maxSizeMB * 1024 * 1024);

        const upload = multer({
            storage,
            limits,
            fileFilter: (fileReq, file, cb) => {
                const extension = getFileExtension(file.originalname);
                if (!allowedFormats.includes(extension)) {
                    return cb(new Error(`File format .${extension || '(none)'} is not allowed. Allowed formats: ${allowedFormats.join(', ')}.`));
                }
                cb(null, true);
            }
        }).single(PRODUCT_VIDEO_FIELD_NAME);

        upload(req, res, (err) => {
            if (err) {
                // A rejected upload can leave a partly written temp file behind.
                if (req.file && req.file.path) {
                    cleanupTempFile(req.file.path)
                        .catch((cleanupErr) => logger.logWarning('productVideoUpload - temp file was not removed', { error: cleanupErr }));
                }
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return common.sendError(res, 413, `Video exceeds the allowed limit of ${maxSizeMB}MB.`);
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
                    return common.sendError(res, 400, `Send exactly one video, in the "${PRODUCT_VIDEO_FIELD_NAME}" field.`);
                }
                return common.sendError(res, 400, err.message);
            }
            next();
        });
    } catch (err) {
        logger.logException('productVideoUpload - Exception while receiving a product video', { vendorId: req.vendorId, error: err });
    }
};

module.exports = productVideoUpload;
