const multer = require('multer');

// Email attachments/images (Company Settings > Email). Memory storage: the
// buffer is checked by fileUploadService / imageUploadService (the vendor's
// real size, extension and count limits from CompanyMaster, plus a content
// check) before any storage provider sees it. This ceiling is only a blunt
// abuse guard - higher than the 20MB imageUpload one because attachments can
// be videos. Override with EMAIL_CONTENT_UPLOAD_MAX_MB.
const hardCeilingMB = Number(process.env.EMAIL_CONTENT_UPLOAD_MAX_MB) || 100;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: hardCeilingMB * 1024 * 1024,
        files: 1
    }
});

module.exports = upload;
