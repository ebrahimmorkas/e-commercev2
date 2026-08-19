const multer = require('multer');
const path = require('path');

const ALLOWED_EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALLOWED_ZIP_MIMES = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

/**
 * Generic multer instance for "excel (+ zero or more zips)" bulk-upload flows.
 * zipFieldName (singular) is kept for backward compatibility with existing
 * callers (e.g. categories). Pass zipFieldNames (array) for modules that need
 * more than one zip (e.g. products: mainImagesZip + additionalImagesZip).
 * If zipFieldNames is omitted, behavior is IDENTICAL to before.
 */
const createBulkUploader = ({
    excelFieldName = 'excelFile',
    zipFieldName = 'imageZip',
    zipFieldNames = null,
    hardSizeCeilingMB = 100
} = {}) => {
    const resolvedZipFields = zipFieldNames || (zipFieldName ? [zipFieldName] : []);
    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (file.fieldname === excelFieldName) {
            if (file.mimetype === ALLOWED_EXCEL_MIME && ext === '.xlsx') {
                return cb(null, true);
            }
            return cb(new Error(`${excelFieldName} must be a .xlsx file`), false);
        }

        if (resolvedZipFields.includes(file.fieldname)) {
            if (ALLOWED_ZIP_MIMES.includes(file.mimetype) && ext === '.zip') {
                return cb(null, true);
            }
            return cb(new Error(`${file.fieldname} must be a .zip file`), false);
        }

        return cb(new Error(`Unexpected field '${file.fieldname}'`), false);
    };

    const uploader = multer({
        storage,
        fileFilter,
        limits: { fileSize: hardSizeCeilingMB * 1024 * 1024 }
    });

    const fields = [{ name: excelFieldName, maxCount: 1 }];
    for (const zipField of resolvedZipFields) {
        fields.push({ name: zipField, maxCount: 1 });
    }

    return uploader.fields(fields);
};

module.exports = createBulkUploader;