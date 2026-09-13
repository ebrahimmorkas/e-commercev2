const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { resolveMaxVideoSizeMB, resolveAllowedVideoFormats, getFileExtension } = require('../services/videoUploadService');
const common = require('../utils/common');

// A banner request carries EITHER an 'image' field or a 'video' field, never both -
// multer only supports one storage engine per instance, so both fields go to disk
// here (not memoryStorage like the generic imageUpload.js) to keep a single shared
// multer config. bannerService reads the (small) image temp file into a buffer
// before handing it to imageUploadService, which expects file.buffer; the video
// temp file is streamed to its provider straight from disk, same as the generic
// video upload path.
const tempDir = path.join(os.tmpdir(), 'banner-media-uploads');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
});

const bannerMediaUpload = (req, res, next) => {
    const maxVideoSizeMB = resolveMaxVideoSizeMB(req.companyMasterData, req.websiteMasterData);
    // See videoUpload.js for why this must be an integer (busboy's size-limit
    // check compares accumulated bytes to this value with strict equality).
    const maxVideoSizeBytes = Math.floor(maxVideoSizeMB * 1024 * 1024);
    const allowedVideoFormats = resolveAllowedVideoFormats(req.companyMasterData, req.websiteMasterData);

    const upload = multer({
        storage,
        limits: {
            // multer needs one ceiling up front for the whole instance; the video
            // limit is used since it's the larger of the two. This is still only a
            // blunt abuse-prevention ceiling - the real per-type business rule
            // (allowedBannerImagesMB / allowedBannerVideoMB) is enforced afterward
            // in bannerService via imageUploadService/videoUploadService.
            fileSize: maxVideoSizeBytes
        },
        // Only the video field's extension is gated here (mirrors videoUpload.js).
        // Image extension/content checks stay inside imageUploadService, same as
        // every other image-uploading module in this codebase.
        fileFilter: (req, file, cb) => {
            if (file.fieldname === 'video') {
                const extension = getFileExtension(file.originalname);
                if (!allowedVideoFormats.map(f => f.toLowerCase()).includes(extension)) {
                    return cb(new Error(`File format .${extension} is not allowed. Allowed formats: ${allowedVideoFormats.join(', ')}.`));
                }
            }
            cb(null, true);
        }
    }).fields([
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 }
    ]);

    // multer/busboy report every rejection (fileFilter's format error, LIMIT_FILE_SIZE,
    // etc.) by calling next(err) - left alone, that falls through to Express's built-in
    // default error handler, which returns a raw stack trace as a 500 instead of the
    // app's normal { success:false, message } JSON contract. Intercepting it here keeps
    // the same clean error shape every other validation failure in this app already has.
    upload(req, res, (err) => {
        if (err) {
            const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return common.sendError(res, statusCode, err.message);
        }
        next();
    });
};

module.exports = bannerMediaUpload;
