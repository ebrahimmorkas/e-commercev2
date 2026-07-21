const streamifier = require('streamifier');
const cloudinary = require('../../config/cloudinaryConfig');
const logger = require('../../utils/logger');

/**
 * @param {Buffer} fileBuffer - raw file buffer (from multer memoryStorage)
 * @param {Object} options
 * @param {string} options.folder - Cloudinary folder path, e.g. "vendorId/categories"
 * @returns {Promise<{url: string, publicId: string}>}
 */
const upload = (fileBuffer, { folder } = {}) => {
    return new Promise((resolve, reject) => {
        try {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) {
                        logger.logException('cloudinaryStorage - upload: Exception while uploading image to Cloudinary', error);
                        return reject(error);
                    }
                    resolve({ url: result.secure_url, publicId: result.public_id });
                }
            );

            streamifier.createReadStream(fileBuffer).pipe(uploadStream);
        } catch (err) {
            logger.logException('cloudinaryStorage - upload: Exception while initiating upload stream', err);
            reject(err);
        }
    });
};

/**
 * @param {string} publicId - Cloudinary public_id of the asset to remove
 */
const deleteImage = async (publicId) => {
    try {
        if (!publicId) return false;
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        logger.logInfo('Image deleted from Cloudinary', { publicId, result });
        return result;
    } catch (err) {
        logger.logException('cloudinaryStorage - deleteImage: Exception while deleting image from Cloudinary', err);
        throw err;
    }
};

module.exports = {
    upload,
    delete: deleteImage
};