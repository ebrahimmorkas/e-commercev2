const multer = require('multer');
const path = require('path');
const logger = require('../../utils/logger');
require('dotenv').config();

const ALLOWED_IMAGE_TYPES = new RegExp(process.env.ALLOWED_IMAGE_TYPES_FOR_IMAGES, 'i');

/**
 * Creates a multer instance backed by memory storage (no disk writes), so the
 * calling controller/service can stream req.file.buffer straight to storageService
 * (Cloudinary / S3 / R2 / whichever provider is active) without ever touching disk.
 *
 * Reusable across any module that needs cloud-uploaded images — categories,
 * banners, products, etc. Usage:
 *   const createMemoryUploader = require('../middlewares/multer/memoryFileUpload');
 *   const categoryUpload = createMemoryUploader({ maxSizeMB: 5 });
 *   router.post('/add-category', categoryUpload.single('image'), ...);
 */
const createMemoryUploader = ({ maxSizeMB = 5, allowedTypes = ALLOWED_IMAGE_TYPES } = {}) => {
    try {
        const storage = multer.memoryStorage();

        const fileFilter = (req, file, cb) => {
            const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimeValid = allowedTypes.test(file.mimetype);

            if (extValid && mimeValid) {
                cb(null, true);
            } else {
                cb(new Error(`Only ${allowedTypes.source.replace(/\|/g, ', ')} files are allowed`));
            }
        };

        return multer({
            storage,
            fileFilter,
            limits: { fileSize: maxSizeMB * 1024 * 1024 }
        });
    } catch (err) {
        logger.logException('memoryFileUpload - createMemoryUploader: Exception in memory uploader middleware', err);
    }
};

module.exports = createMemoryUploader;