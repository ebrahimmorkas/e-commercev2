const fs = require('fs');
const imagekitProvider = require('./imagekitProvider');

// Account passed on every call - see imagekitProvider.js.

// Videos are streamed from multer's temp file instead of read into memory.
// ImageKit has no chunked upload, so the whole file goes in one request: it
// gets a longer timeout, and a video bigger than the account's plan allows is
// rejected by ImageKit itself (set WebsiteMaster / CompanyMaster.maxVideoSize
// to the plan's limit so it is refused before the upload instead).
const VIDEO_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

// filePath -> { url, key }
const upload = async (filePath, meta, credentials) => {
    try {
        return await imagekitProvider.uploadFile(fs.createReadStream(filePath), meta, credentials, { timeout: VIDEO_UPLOAD_TIMEOUT_MS });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    upload,
    delete: imagekitProvider.delete
};
