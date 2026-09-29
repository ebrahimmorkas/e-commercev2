const cloudinaryFileProvider = require('./cloudinaryFileProvider');
const awsProvider = require('./awsProvider');
const r2Provider = require('./r2Provider');
const localProvider = require('./localProvider');

// The S3, R2 and local adapters already store any buffer as-is (with the
// verified ContentType), so they're shared with images; only Cloudinary
// needs its own 'raw' adapter for non-media files.
const providers = {
    cloudinary: cloudinaryFileProvider,
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
        throw new Error(`Unsupported file provider: ${providerName}`);
    }
    return provider;
};

module.exports = {
    getProvider
};
