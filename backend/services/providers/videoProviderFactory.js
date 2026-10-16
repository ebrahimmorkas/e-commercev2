const cloudinaryVideoProvider = require('./cloudinaryVideoProvider');
const { createVideoProvider } = require('./s3Provider');
const localVideoProvider = require('./localVideoProvider');
const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');

const providers = {
    [STORAGE_PROVIDERS.CLOUDINARY]: cloudinaryVideoProvider,
    [STORAGE_PROVIDERS.AWS]: createVideoProvider(STORAGE_PROVIDERS.AWS),
    [STORAGE_PROVIDERS.R2]: createVideoProvider(STORAGE_PROVIDERS.R2),
    [STORAGE_PROVIDERS.LOCAL]: localVideoProvider
};

// Every provider adapter implements the same interface:
//   upload(filePath, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>
// credentials comes from storageCredentialsService - adapters never read .env themselves.
const getProvider = (providerName) => {
    try {
        const provider = providers[providerName];
        if (!provider) {
            throw new Error(`Unsupported video provider: ${providerName}`);
        }
        return provider;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getProvider
};
