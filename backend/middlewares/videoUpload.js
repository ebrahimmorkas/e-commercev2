const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { resolveMaxVideoSizeMB, resolveAllowedVideoFormats, getFileExtension } = require('../services/videoUploadService');

// Disk storage, not memory: videos are far bigger than images, and buffering
// one whole in RAM (like imageUpload.js does) doesn't scale. The file is
// written to a temp dir; videoUploadService validates it (size/format/magic
// bytes) and streams it on to the provider from there, then deletes it.
const tempDir = path.join(os.tmpdir(), 'video-uploads');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
});

// The multer ceiling itself is not a fixed constant - it comes from
// WebsiteMaster/CompanyMaster.maxVideoSize (see resolveMaxVideoSizeMB), which
// is per-vendor DB data, not something known when this module is first
// required. So a fresh multer instance is built per request instead of once
// at module load, using whatever ensureVendorDataCached already attached to
// req.companyMasterData/req.websiteMasterData earlier in the route chain.
// This is still only a blunt abuse-prevention ceiling, not the granular
// per-module business rule (that's enforced separately in videoUploadService
// via companyMasterData[maxSizeField]).
const videoUpload = (req, res, next) => {
    const maxSizeMB = resolveMaxVideoSizeMB(req.companyMasterData, req.websiteMasterData);
    // Must be an integer: busboy's internal size-limit check compares accumulated
    // bytes to this value with strict equality, so a fractional limit (e.g. from a
    // non-whole maxVideoSize like 2.5MB) can never be hit exactly - the 'limit'
    // event silently never fires, and the file gets truncated instead of rejected.
    const maxSizeBytes = Math.floor(maxSizeMB * 1024 * 1024);
    const allowedFormats = resolveAllowedVideoFormats(req.companyMasterData, req.websiteMasterData);

    const upload = multer({
        storage,
        limits: {
            fileSize: maxSizeBytes
        },
        // Rejects a disallowed extension before the file is even written to the
        // temp dir. This is only a fast extension-name gate, not a security
        // guarantee - videoUploadService's magic-byte content check (which still
        // runs afterward on whatever does make it through) is what actually
        // catches a spoofed/renamed file.
        fileFilter: (req, file, cb) => {
            const extension = getFileExtension(file.originalname);
            if (!allowedFormats.map(f => f.toLowerCase()).includes(extension)) {
                return cb(new Error(`File format .${extension} is not allowed. Allowed formats: ${allowedFormats.join(', ')}.`));
            }
            cb(null, true);
        }
    }).single('video');

    upload(req, res, next);
};

module.exports = videoUpload;
