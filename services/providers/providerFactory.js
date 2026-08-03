const cloudinaryProvider = require('./cloudinaryProvider');
const awsProvider = require('./awsProvider');
const r2Provider = require('./r2Provider');
const localProvider = require('./localProvider');

const providers = {
    cloudinary: cloudinaryProvider,
    aws: awsProvider,
    r2: r2Provider,
    local: localProvider
};

// Every provider adapter implements the same interface:
//   upload(buffer, meta) -> Promise<{ url, key }>
//   delete(key) -> Promise<void>
const getProvider = (providerName) => {
    const provider = providers[providerName];
    if (!provider) {
        throw new Error(`Unsupported image provider: ${providerName}`);
    }
    return provider;
};

module.exports = {
    getProvider
};