const cloudinary = require('cloudinary').v2;
const imageProviderConfig = require('../../config/imageProviderConfig');

cloudinary.config({
    cloud_name: imageProviderConfig.cloudinary.cloudName,
    api_key: imageProviderConfig.cloudinary.apiKey,
    api_secret: imageProviderConfig.cloudinary.apiSecret
});

// buffer -> { url, key }
const upload = (buffer, meta) => {
    return new Promise((resolve, reject) => {
        const folder = `${meta.vendorId}/${meta.module}`;
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (err, result) => {
                if (err) return reject(err);
                resolve({ url: result.secure_url, key: result.public_id });
            }
        );
        uploadStream.end(buffer);
    });
};

const deleteFile = async (key) => {
    await cloudinary.uploader.destroy(key, { resource_type: 'image' });
};

module.exports = {
    upload,
    delete: deleteFile
};