const FileAsset = require('../models/FileAsset');
const { getProvider } = require('./providers/fileProviderFactory');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { fileTypeFromBuffer } = require('file-type');

/*
|--------------------------------------------------------------------------
| FILE UPLOADS (the non-image-only counterpart of imageUploadService)
|--------------------------------------------------------------------------
| Any file type the vendor is allowed (e.g. PDF, DOCX, XLSX, MP4, JPG ...),
| stored byte-for-byte on the vendor's file storage provider and tracked as
| a FileAsset. Every upload is checked for:
|   - size / extension / count against the CompanyMaster fields the caller
|     names (same field-name convention as imageUploadService);
|   - its real content: a format that has a signature must actually be that
|     format (a renamed .exe can't pass as .pdf), and a format without one
|     (CSV, TXT, ...) must be plain text;
|   - never an executable/script/markup file, whatever the allowed list says.
*/

// Never accepted, even if an admin adds them to the allowed list - they
// could run code on whoever opens them.
const BLOCKED_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'cpl', 'dll', 'jar', 'js', 'mjs', 'vbs', 'vbe', 'wsf',
    'ps1', 'sh', 'php', 'py', 'html', 'htm', 'xhtml', 'svg', 'hta', 'apk', 'app', 'dmg', 'deb', 'rpm', 'iso'
];
const BLOCKED_DETECTED = ['exe', 'elf', 'msi', 'dll', 'mach', 'macho', 'apk', 'dmg', 'deb', 'rpm', 'cab', 'swf', 'class', 'wasm', 'html', 'xml'];

// A detected format -> the extensions a file of that format may carry.
const EQUIVALENT_EXTENSIONS = {
    jpg: ['jpg', 'jpeg'],
    tif: ['tif', 'tiff'],
    cfb: ['doc', 'xls', 'ppt', 'msg'], // older Office files share one container format
    mp4: ['mp4', 'm4v'],
    mov: ['mov', 'qt'],
    mkv: ['mkv'],
    '3gp': ['3gp', '3gpp']
};

// Formats with no signature - accepted only when the content is plain text.
const TEXT_MIME_TYPES = {
    txt: 'text/plain',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
    md: 'text/markdown',
    log: 'text/plain',
    ics: 'text/calendar',
    vcf: 'text/vcard'
};

const getFileExtension = (originalName = '') => {
    try {
        const parts = String(originalName).split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    } catch (err) {
        throw err;
    }
};

// Same rule as imageUploadService: the website-wide provider when it's
// enforced, else the vendor's own, else the website-wide default.
const resolveFileProvider = (companyMasterData, websiteMasterData) => {
    try {
        if (websiteMasterData && websiteMasterData.enforceMainFileService === true) {
            return websiteMasterData.mainFileService;
        }
        return (companyMasterData && companyMasterData.fileService) || (websiteMasterData && websiteMasterData.mainFileService) || null;
    } catch (err) {
        throw err;
    }
};

// Size and extension against the CompanyMaster fields the caller names.
const validateFile = (file, { maxSizeField, allowedFormatsField }, companyMasterData) => {
    try {
        const extension = getFileExtension(file.originalname);
        if (!extension) {
            return { valid: false, message: 'The file has no extension, so its type cannot be checked.' };
        }
        if (BLOCKED_EXTENSIONS.includes(extension)) {
            return { valid: false, message: `.${extension} files are not allowed for security reasons.` };
        }

        if (maxSizeField && companyMasterData && companyMasterData[maxSizeField] != null) {
            const maxSizeMB = companyMasterData[maxSizeField];
            if (file.size > maxSizeMB * 1024 * 1024) {
                return { valid: false, message: `File size exceeds the allowed limit of ${maxSizeMB}MB.` };
            }
        }

        // An empty list means no format restriction (same as imageUploadService).
        const allowedList = [].concat((allowedFormatsField && companyMasterData ? companyMasterData[allowedFormatsField] : null) || [])
            .filter(Boolean)
            .map((f) => String(f).toLowerCase().replace(/^\./, ''));
        if (allowedList.length > 0 && !allowedList.includes(extension)) {
            return { valid: false, message: `File format .${extension} is not allowed. Allowed formats: ${allowedList.join(', ')}.` };
        }

        return { valid: true, extension };
    } catch (err) {
        throw err;
    }
};

// The file's actual bytes must match its extension. Returns the verified mime type.
const validateFileContent = async (file, extension) => {
    try {
        const detected = await fileTypeFromBuffer(file.buffer);

        if (detected) {
            if (BLOCKED_DETECTED.includes(detected.ext)) {
                return { valid: false, message: 'This type of file is not allowed for security reasons.' };
            }
            const acceptable = EQUIVALENT_EXTENSIONS[detected.ext] || [detected.ext];
            if (!acceptable.includes(extension)) {
                return { valid: false, message: `File content does not match its .${extension} extension.` };
            }
            return { valid: true, mimeType: detected.mime };
        }

        // No signature: only plain-text formats, and the content must really be text.
        if (!TEXT_MIME_TYPES[extension]) {
            return { valid: false, message: `The file is not a valid, readable .${extension} file.` };
        }
        if (file.buffer.subarray(0, 8192).includes(0)) {
            return { valid: false, message: `The file is not a valid .${extension} text file.` };
        }
        return { valid: true, mimeType: TEXT_MIME_TYPES[extension] };
    } catch (err) {
        throw err;
    }
};

const uploadFile = async ({
    vendorId,
    module,
    file,
    userId,
    maxSizeField,
    allowedFormatsField,
    maxCountField,
    companyMasterData,
    websiteMasterData
}) => {
    try {
        if (!file || !file.buffer) {
            return common.returnResult(false, 400, 'File is required.');
        }

        const validation = validateFile(file, { maxSizeField, allowedFormatsField }, companyMasterData);
        if (!validation.valid) {
            return common.returnResult(false, 400, validation.message);
        }

        const contentCheck = await validateFileContent(file, validation.extension);
        if (!contentCheck.valid) {
            return common.returnResult(false, 400, contentCheck.message);
        }

        if (maxCountField && companyMasterData && companyMasterData[maxCountField] != null) {
            const maxCount = companyMasterData[maxCountField];
            const existingCount = await FileAsset.countDocuments({ vendorId, module, status: 'A' });
            if (existingCount >= maxCount) {
                return common.returnResult(false, 400, `Upload limit reached. Only ${maxCount} file(s) are allowed here.`);
            }
        }

        const providerName = resolveFileProvider(companyMasterData, websiteMasterData);
        if (!providerName) {
            return common.returnResult(false, 400, 'No file storage provider configured for this vendor.');
        }

        const provider = getProvider(providerName);
        const { url, key } = await provider.upload(file.buffer, {
            vendorId,
            module,
            originalName: file.originalname,
            mimeType: contentCheck.mimeType
        });

        const fileAsset = await FileAsset.create({
            vendorId,
            module,
            provider: providerName,
            url,
            key,
            originalName: file.originalname,
            mimeType: contentCheck.mimeType,
            extension: validation.extension,
            size: file.size,
            status: 'A',
            createdBy: userId
        });

        logger.logInfo(1, 0, 'File uploaded successfully', { vendorId, module, provider: providerName });
        return common.returnResult(true, 201, 'File uploaded successfully', { file: fileAsset });
    } catch (err) {
        throw err;
    }
};

// Removes the stored file from its provider and soft-deletes the FileAsset.
const deleteFile = async ({ vendorId, fileId, userId }) => {
    try {
        const existingFile = await FileAsset.findOne({ _id: fileId, vendorId, status: { $ne: 'D' } });
        if (!existingFile) {
            return common.returnResult(false, 404, 'File not found.');
        }

        const provider = getProvider(existingFile.provider);
        await provider.delete(existingFile.key);

        existingFile.status = 'D';
        existingFile.deletedBy = userId;
        await existingFile.save();

        logger.logInfo(1, 0, 'File deleted successfully', { vendorId, fileId });
        return common.returnResult(true, 200, 'File deleted successfully');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveFileProvider,
    uploadFile,
    deleteFile,
    validateFileContent
};
