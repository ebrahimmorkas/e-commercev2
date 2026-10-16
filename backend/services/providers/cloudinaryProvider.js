const cloudinary = require('cloudinary').v2;

// The account is passed on every call (cloud_name/api_key/api_secret in the
// call's options) - the vendor's own or the platform's, see
// storageCredentialsService. cloudinary.config() must NEVER be called anywhere
// in the app: it is process-wide, so it would mix vendors' accounts up, and the
// SDK silently falls back to it for any option a call leaves out.
const accountOptions = (credentials) => {
    try {
        return {
            cloud_name: credentials.cloudName,
            api_key: credentials.apiKey,
            api_secret: credentials.apiSecret,
            secure: true
        };
    } catch (err) {
        throw err;
    }
};

// buffer -> { url, key }
const upload = (buffer, meta, credentials) => {
    return new Promise((resolve, reject) => {
        try {
            const folder = `${meta.vendorId}/${meta.module}`;
            const uploadStream = cloudinary.uploader.upload_stream(
                { ...accountOptions(credentials), folder, resource_type: 'image' },
                (err, result) => {
                    if (err) return reject(err);
                    resolve({ url: result.secure_url, key: result.public_id });
                }
            );
            uploadStream.end(buffer);
        } catch (err) {
            reject(err);
        }
    });
};

const deleteFile = async (key, credentials) => {
    try {
        await cloudinary.uploader.destroy(key, { ...accountOptions(credentials), resource_type: 'image' });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    accountOptions,
    upload,
    delete: deleteFile
};
