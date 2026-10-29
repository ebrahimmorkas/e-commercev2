const cloudinaryFileProvider = require('./cloudinaryFileProvider');
const { createBufferProvider } = require('./s3Provider');
const imagekitProvider = require('./imagekitProvider');
const localProvider = require('./localProvider');
const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');

// The S3, R2, ImageKit and local adapters already store any buffer as-is
// (with the verified content type), so they're shared with images; only
// Cloudinary needs its own 'raw' adapter for non-media files.
const providers = {
    [STORAGE_PROVIDERS.CLOUDINARY]: cloudinaryFileProvider,
    [STORAGE_PROVIDERS.AWS]: createBufferProvider(STORAGE_PROVIDERS.AWS),
    [STORAGE_PROVIDERS.R2]: createBufferProvider(STORAGE_PROVIDERS.R2),
    [STORAGE_PROVIDERS.IMAGEKIT]: imagekitProvider,
    [STORAGE_PROVIDERS.LOCAL]: localProvider
};

// Every provider adapter implements the same interface:
//   upload(buffer, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>
// credentials comes from storageCredentialsService - adapters never read .env themselves.
const getProvider = (providerName) => {
    try {
        const provider = providers[providerName];
        if (!provider) {
            throw new Error(`Unsupported file provider: ${providerName}`);
        }
        return provider;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getProvider
};
