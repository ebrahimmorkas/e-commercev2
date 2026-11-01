const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const ALLOWED_EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALLOWED_ZIP_MIMES = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

// Where disk zip fields (see diskZipFieldNames) are written. The caller must
// delete the file once it is done with it (req.files[field][0].path).
const DISK_ZIP_TEMP_DIR = path.join(os.tmpdir(), 'bulk-upload-zips');

// Storage engine that keeps every field in memory (file.buffer), except the
// disk fields, which go to DISK_ZIP_TEMP_DIR (file.path). Each memory field is
// still held to memoryMaxBytes on its own: multer's own fileSize limit is
// raised to the disk ceiling, which must not let an image zip grow that big
// in memory.
const createFieldRoutingStorage = ({ diskFieldNames, memoryMaxBytes }) => {
    const memory = multer.memoryStorage();
    const disk = multer.diskStorage({
        destination: (req, file, cb) => {
            try {
                fs.mkdirSync(DISK_ZIP_TEMP_DIR, { recursive: true });
                cb(null, DISK_ZIP_TEMP_DIR);
            } catch (err) {
                cb(err);
            }
        },
        filename: (req, file, cb) => {
            try {
                cb(null, `${randomUUID()}-${path.basename(file.originalname)}`);
            } catch (err) {
                cb(err);
            }
        }
    });

    return {
        _handleFile: (req, file, cb) => {
            try {
                if (diskFieldNames.includes(file.fieldname)) {
                    return disk._handleFile(req, file, cb);
                }

                let receivedBytes = 0;
                let isRejected = false;
                file.stream.on('data', (chunk) => {
                    try {
                        receivedBytes += chunk.length;
                        if (!isRejected && receivedBytes > memoryMaxBytes) {
                            isRejected = true;
                            cb(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname));
                        }
                    } catch (err) {
                        if (!isRejected) {
                            isRejected = true;
                            cb(err);
                        }
                    }
                });
                memory._handleFile(req, file, (err, info) => {
                    try {
                        if (isRejected) return;
                        cb(err, info);
                    } catch (callbackErr) {
                        cb(callbackErr);
                    }
                });
            } catch (err) {
                cb(err);
            }
        },
        _removeFile: (req, file, cb) => {
            try {
                if (file.path) return disk._removeFile(req, file, cb);
                return memory._removeFile(req, file, cb);
            } catch (err) {
                cb(err);
            }
        }
    };
};

/**
 * Generic multer instance for "excel (+ zero or more zips)" bulk-upload flows.
 * zipFieldName (singular) is kept for backward compatibility with existing
 * callers (e.g. categories). Pass zipFieldNames (array) for modules that need
 * more than one zip (e.g. products: mainImagesZip + additionalImagesZip).
 * If zipFieldNames is omitted, behavior is IDENTICAL to before.
 *
 * diskZipFieldNames: zip fields that are written to disk instead of memory
 * (file.path, not file.buffer) - for zips too big for memory, e.g. product
 * videos. Their ceiling comes from resolveDiskZipMaxSizeMB(req) per request
 * (e.g. a WebsiteMaster value - ensureVendorDataCached must run earlier).
 * Without disk fields the uploader is built once, exactly as before.
 */
const createBulkUploader = ({
    excelFieldName = 'excelFile',
    zipFieldName = 'imageZip',
    zipFieldNames = null,
    hardSizeCeilingMB = 100,
    diskZipFieldNames = [],
    resolveDiskZipMaxSizeMB = null
} = {}) => {
    const resolvedZipFields = zipFieldNames || (zipFieldName ? [zipFieldName] : []);
    const allZipFields = [...resolvedZipFields, ...diskZipFieldNames];

    const fileFilter = (req, file, cb) => {
        try {
            const ext = path.extname(file.originalname).toLowerCase();

            if (file.fieldname === excelFieldName) {
                if (file.mimetype === ALLOWED_EXCEL_MIME && ext === '.xlsx') {
                    return cb(null, true);
                }
                return cb(new Error(`${excelFieldName} must be a .xlsx file`), false);
            }

            if (allZipFields.includes(file.fieldname)) {
                if (ALLOWED_ZIP_MIMES.includes(file.mimetype) && ext === '.zip') {
                    return cb(null, true);
                }
                return cb(new Error(`${file.fieldname} must be a .zip file`), false);
            }

            return cb(new Error(`Unexpected field '${file.fieldname}'`), false);
        } catch (err) {
            cb(err, false);
        }
    };

    const fields = [{ name: excelFieldName, maxCount: 1 }];
    for (const zipField of allZipFields) {
        fields.push({ name: zipField, maxCount: 1 });
    }

    if (diskZipFieldNames.length === 0) {
        const uploader = multer({
            storage: multer.memoryStorage(),
            fileFilter,
            limits: { fileSize: hardSizeCeilingMB * 1024 * 1024 }
        });
        return uploader.fields(fields);
    }

    const memoryMaxBytes = hardSizeCeilingMB * 1024 * 1024;
    return (req, res, next) => {
        try {
            const diskMaxSizeMB = Number(resolveDiskZipMaxSizeMB ? resolveDiskZipMaxSizeMB(req) : 0) || hardSizeCeilingMB;
            const uploader = multer({
                storage: createFieldRoutingStorage({ diskFieldNames: diskZipFieldNames, memoryMaxBytes }),
                fileFilter,
                // Whole bytes: busboy compares with strict equality (see videoUpload.js).
                limits: { fileSize: Math.floor(Math.max(memoryMaxBytes, diskMaxSizeMB * 1024 * 1024)) }
            });

            uploader.fields(fields)(req, res, (err) => {
                try {
                    if (err) {
                        // A rejected request must not leave a half-written zip behind.
                        for (const field of diskZipFieldNames) {
                            const file = req.files?.[field]?.[0];
                            if (file?.path) fs.promises.unlink(file.path).catch(() => {});
                        }
                    }
                    next(err);
                } catch (callbackErr) {
                    next(callbackErr);
                }
            });
        } catch (err) {
            next(err);
        }
    };
};

module.exports = createBulkUploader;
module.exports.DISK_ZIP_TEMP_DIR = DISK_ZIP_TEMP_DIR;
