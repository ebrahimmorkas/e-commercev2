const cloudinary = require('cloudinary').v2;
const videoProviderConfig = require('../../config/videoProviderConfig');

cloudinary.config({
    cloud_name: videoProviderConfig.cloudinary.cloudName,
    api_key: videoProviderConfig.cloudinary.apiKey,
    api_secret: videoProviderConfig.cloudinary.apiSecret
});

// filePath -> { url, key }
// upload_large (chunked) is used instead of plain upload() because Cloudinary
// rejects large videos on the non-chunked endpoint - this is Cloudinary's
// documented approach for video specifically.
const upload = (filePath, meta) => {
    return new Promise((resolve, reject) => {
        const folder = `${meta.vendorId}/${meta.module}`;
        cloudinary.uploader.upload_large(
            filePath,
            { folder, resource_type: 'video', chunk_size: 6 * 1024 * 1024 },
            (err, result) => {
                if (err) return reject(err);
                resolve({ url: result.secure_url, key: result.public_id });
            }
        );
    });
};

const deleteFile = async (key) => {
    await cloudinary.uploader.destroy(key, { resource_type: 'video' });
};

module.exports = {
    upload,
    delete: deleteFile
};
