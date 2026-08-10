const multer = require('multer');

// Memory storage: we never trust the request enough to write straight to disk.
// The buffer is validated by imageUploadService (real size/format rules per module)
// before it's handed to any storage provider. The 20MB cap here is only a blunt
// abuse-prevention limit, not the real business rule.
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB hard ceiling
    }
});

module.exports = upload;