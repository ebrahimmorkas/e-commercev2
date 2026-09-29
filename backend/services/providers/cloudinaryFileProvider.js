const cloudinary = require('cloudinary').v2;
const imageProviderConfig = require('../../config/imageProviderConfig');

// Same Cloudinary account as images (config/imageProviderConfig.js), but
// stored as resource_type 'raw' so any file (PDF, DOCX, XLSX, MP4, ...) is
// kept byte-for-byte as uploaded - the image/video providers would convert
// or reject non-media files.
cloudinary.config({
    cloud_name: imageProviderConfig.cloudinary.cloudName,
    api_key: imageProviderConfig.cloudinary.apiKey,
    api_secret: imageProviderConfig.cloudinary.apiSecret
});

// buffer -> { url, key }
const upload = (buffer, meta) => {
    return new Promise((resolve, reject) => {
        const folder = `${meta.vendorId}/${meta.module}`;
        const stream = cloudinary.uploader.upload_stream(
            // use_filename keeps the extension in the public id, so the raw
            // file downloads with a usable name.
            { folder, resource_type: 'raw', use_filename: true, unique_filename: true, filename_override: meta.originalName },
            (err, result) => {
                if (err) return reject(err);
                resolve({ url: result.secure_url, key: result.public_id });
            }
        );
        stream.end(buffer);
    });
};

const deleteFile = async (key) => {
    await cloudinary.uploader.destroy(key, { resource_type: 'raw' });
};

module.exports = {
    upload,
    delete: deleteFile
};
