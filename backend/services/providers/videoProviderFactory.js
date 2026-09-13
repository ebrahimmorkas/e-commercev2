const cloudinaryVideoProvider = require('./cloudinaryVideoProvider');
const awsVideoProvider = require('./awsVideoProvider');
const r2VideoProvider = require('./r2VideoProvider');
const localVideoProvider = require('./localVideoProvider');

const providers = {
    cloudinary: cloudinaryVideoProvider,
    aws: awsVideoProvider,
    r2: r2VideoProvider,
    local: localVideoProvider
};

// Every provider adapter implements the same interface:
//   upload(filePath, meta) -> Promise<{ url, key }>
//   delete(key) -> Promise<void>
const getProvider = (providerName) => {
    const provider = providers[providerName];
    if (!provider) {
        throw new Error(`Unsupported video provider: ${providerName}`);
    }
    return provider;
};

module.exports = {
    getProvider
};
