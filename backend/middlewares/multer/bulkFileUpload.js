const multer = require('multer');
const path = require('path');

const ALLOWED_EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALLOWED_ZIP_MIMES = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

/**
 * Generic multer instance for "excel (+ optional zip)" bulk-upload flows,
 * reusable across any module (categories, products, discounts, banners, ...).
 * Not tied to a specific module - callers configure field names.
 *
 * The size limit here is a blunt, hard abuse-prevention ceiling only. The
 * REAL, vendor-configurable limits (WebsiteMaster.bulkUploadExcelMaxSizeMB /
 * bulkUploadZipMaxSizeMB) are enforced per-module in the controller, once
 * req.websiteMasterData is available - same pattern as imageUploadService.
 *
 * @param {Object} [options]
 * @param {string} [options.excelFieldName='excelFile']
 * @param {string|null} [options.zipFieldName='imageZip'] - pass null for modules with no image zip
 * @param {number} [options.hardSizeCeilingMB=100]
 *
 * Usage:
 *   const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
 *   const categoryBulkUpload = createBulkUploader(); // excelFile + imageZip
 *   const discountBulkUpload = createBulkUploader({ zipFieldName: null }); // excel only
 */
const createBulkUploader = ({
    excelFieldName = 'excelFile',
    zipFieldName = 'imageZip',
    hardSizeCeilingMB = 100
} = {}) => {
    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (file.fieldname === excelFieldName) {
            if (file.mimetype === ALLOWED_EXCEL_MIME && ext === '.xlsx') {
                return cb(null, true);
            }
            return cb(new Error(`${excelFieldName} must be a .xlsx file`), false);
        }

        if (zipFieldName && file.fieldname === zipFieldName) {
            if (ALLOWED_ZIP_MIMES.includes(file.mimetype) && ext === '.zip') {
                return cb(null, true);
            }
            return cb(new Error(`${zipFieldName} must be a .zip file`), false);
        }

        return cb(new Error(`Unexpected field '${file.fieldname}'`), false);
    };

    const uploader = multer({
        storage,
        fileFilter,
        limits: { fileSize: hardSizeCeilingMB * 1024 * 1024 }
    });

    const fields = [{ name: excelFieldName, maxCount: 1 }];
    if (zipFieldName) fields.push({ name: zipFieldName, maxCount: 1 });

    return uploader.fields(fields);
};

module.exports = createBulkUploader;