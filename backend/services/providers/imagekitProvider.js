const path = require('path');
const ImageKit = require('@imagekit/nodejs');

// The account is passed on every call (urlEndpoint/privateKey) - the vendor's
// own or the platform's, see storageCredentialsService. A client is built per
// call from those credentials and nothing is ever configured process-wide.
//
// The SDK silently falls back to process.env.IMAGEKIT_PRIVATE_KEY (and
// IMAGE_KIT_BASE_URL) for any option the constructor is not given - which
// would upload a vendor's file into the platform's account - so the private
// key is checked here and baseURL is always passed explicitly.
const API_BASE_URL = 'https://api.imagekit.io';
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

const createClient = (credentials, { timeout } = {}) => {
    try {
        if (!credentials || !credentials.privateKey || !credentials.urlEndpoint) {
            throw new Error('ImageKit credentials are incomplete (urlEndpoint and privateKey are required).');
        }
        return new ImageKit({
            privateKey: credentials.privateKey,
            baseURL: API_BASE_URL,
            // Uploads are not idempotent (every retry would store another
            // uniquely-named copy) and a read stream can't be replayed.
            maxRetries: 0,
            ...(timeout ? { timeout } : {})
        });
    } catch (err) {
        throw err;
    }
};

// ImageKit folder names allow a-z A-Z 0-9 / _ - only.
const buildFolder = (meta) => {
    try {
        return `/${meta.vendorId}/${meta.module}`.replace(/[^A-Za-z0-9/_-]/g, '_');
    } catch (err) {
        throw err;
    }
};

// ImageKit file names allow a-z A-Z 0-9 . - (it would turn anything else into
// _ itself). The extension is kept so the file is served and downloaded with
// a usable name; useUniqueFileName adds a random suffix, so two uploads with
// the same original name never overwrite each other.
const MAX_BASE_NAME_LENGTH = 100;

const buildFileName = (originalName) => {
    try {
        const name = String(originalName || '');
        const extension = path.extname(name).replace(/[^A-Za-z0-9.]/g, '').toLowerCase();
        const baseName = path.basename(name, path.extname(name))
            .replace(/[^A-Za-z0-9.-]/g, '_')
            .slice(0, MAX_BASE_NAME_LENGTH);
        return `${baseName || 'file'}${extension}`;
    } catch (err) {
        throw err;
    }
};

// The URL is built from the account's own urlEndpoint (which may be a custom
// domain) rather than taken from the response, which always uses the default
// ik.imagekit.io endpoint.
const toStoredFile = (client, credentials, result) => {
    try {
        if (!result || !result.fileId) {
            throw new Error('ImageKit upload did not return a fileId.');
        }
        const url = result.filePath
            ? client.helper.buildSrc({ urlEndpoint: credentials.urlEndpoint, src: result.filePath })
            : result.url;
        // key = fileId: ImageKit can only delete a file by its fileId.
        return { url, key: result.fileId };
    } catch (err) {
        throw err;
    }
};

// file is anything the SDK accepts (toFile(...) result, fs.ReadStream).
// -> { url, key }
const uploadFile = async (file, meta, credentials, { timeout = UPLOAD_TIMEOUT_MS } = {}) => {
    try {
        const client = createClient(credentials, { timeout });
        const result = await client.files.upload({
            file,
            fileName: buildFileName(meta.originalName),
            folder: buildFolder(meta),
            useUniqueFileName: true
        });
        return toStoredFile(client, credentials, result);
    } catch (err) {
        throw err;
    }
};

// Shared by images, videos and files - ImageKit deletes every kind of file
// the same way. A file that is already gone counts as deleted (like
// Cloudinary's destroy), so a replace/delete still goes ahead.
const deleteFile = async (key, credentials) => {
    try {
        const client = createClient(credentials);
        try {
            await client.files.delete(key);
        } catch (err) {
            if (err instanceof ImageKit.NotFoundError) return;
            throw err;
        }
    } catch (err) {
        throw err;
    }
};

// buffer -> { url, key }
const upload = async (buffer, meta, credentials) => {
    try {
        const fileName = buildFileName(meta.originalName);
        const file = await ImageKit.toFile(buffer, fileName, meta.mimeType ? { type: meta.mimeType } : undefined);
        return await uploadFile(file, meta, credentials);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createClient,
    uploadFile,
    upload,
    delete: deleteFile
};
