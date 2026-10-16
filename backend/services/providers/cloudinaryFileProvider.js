const cloudinary = require('cloudinary').v2;
const { accountOptions } = require('./cloudinaryProvider');

// Stored as resource_type 'raw' so any file (PDF, DOCX, XLSX, MP4, ...) is
// kept byte-for-byte as uploaded - the image/video providers would convert
// or reject non-media files. Account passed on every call - see cloudinaryProvider.js.

// buffer -> { url, key }
const upload = (buffer, meta, credentials) => {
    return new Promise((resolve, reject) => {
        try {
            const folder = `${meta.vendorId}/${meta.module}`;
            const stream = cloudinary.uploader.upload_stream(
                // use_filename keeps the extension in the public id, so the raw
                // file downloads with a usable name.
                { ...accountOptions(credentials), folder, resource_type: 'raw', use_filename: true, unique_filename: true, filename_override: meta.originalName },
                (err, result) => {
                    if (err) return reject(err);
                    resolve({ url: result.secure_url, key: result.public_id });
                }
            );
            stream.end(buffer);
        } catch (err) {
            reject(err);
        }
    });
};

const deleteFile = async (key, credentials) => {
    try {
        await cloudinary.uploader.destroy(key, { ...accountOptions(credentials), resource_type: 'raw' });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    upload,
    delete: deleteFile
};
