const cloudinaryProvider = require('./cloudinaryProvider');
const { createBufferProvider } = require('./s3Provider');
const localProvider = require('./localProvider');
const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');

const providers = {
    [STORAGE_PROVIDERS.CLOUDINARY]: cloudinaryProvider,
    [STORAGE_PROVIDERS.AWS]: createBufferProvider(STORAGE_PROVIDERS.AWS),
    [STORAGE_PROVIDERS.R2]: createBufferProvider(STORAGE_PROVIDERS.R2),
    [STORAGE_PROVIDERS.LOCAL]: localProvider
};

// Every provider adapter implements the same interface:
//   upload(buffer, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>
// credentials comes from storageCredentialsService (resolveUploadTarget /
// resolveAssetCredentials) - adapters never read .env themselves.
const getProvider = (providerName) => {
    try {
        const provider = providers[providerName];
        if (!provider) {
            throw new Error(`Unsupported image provider: ${providerName}`);
        }
        return provider;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getProvider
};
