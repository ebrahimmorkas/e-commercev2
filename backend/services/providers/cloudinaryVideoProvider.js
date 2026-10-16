const cloudinary = require('cloudinary').v2;
const { accountOptions } = require('./cloudinaryProvider');

// Account passed on every call - see cloudinaryProvider.js.

// filePath -> { url, key }
// upload_large (chunked) is used instead of plain upload() because Cloudinary
// rejects large videos on the non-chunked endpoint - this is Cloudinary's
// documented approach for video specifically.
const upload = (filePath, meta, credentials) => {
    return new Promise((resolve, reject) => {
        try {
            const folder = `${meta.vendorId}/${meta.module}`;
            cloudinary.uploader.upload_large(
                filePath,
                { ...accountOptions(credentials), folder, resource_type: 'video', chunk_size: 6 * 1024 * 1024 },
                (err, result) => {
                    if (err) return reject(err);
                    resolve({ url: result.secure_url, key: result.public_id });
                }
            );
        } catch (err) {
            reject(err);
        }
    });
};

const deleteFile = async (key, credentials) => {
    try {
        await cloudinary.uploader.destroy(key, { ...accountOptions(credentials), resource_type: 'video' });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    upload,
    delete: deleteFile
};
