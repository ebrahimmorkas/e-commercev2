const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');

const ALLOWED_IMAGE_TYPES = /jpg|jpeg|png|gif/;

const createUploader = ({ folder, maxSizeMB = 5, allowedTypes = ALLOWED_IMAGE_TYPES }) => {
    try {
        // Create folder if it doesn't exist
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, folder);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname).toLowerCase();
            const prefix = path.basename(folder); // e.g. 'banners', 'products'
            cb(null, `${prefix}-${uniqueSuffix}${ext}`);
        }
    });

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
        logger.logException(`fileUpload - createUploader: Exception in fileUpload middleware. Message is: ${err.message} and stack is ${err.stack}`, {vendorID, err});
    }
};

module.exports = createUploader;