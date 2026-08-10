const logger = require('../utils/logger');

// Add new providers here as they are implemented. Each provider module must
// export { upload(fileBuffer, options) -> {url, publicId}, delete(publicId) }.
const providers = {
    cloudinary: () => require('./storageProviders/cloudinaryStorage'),
    // s3: () => require('./storageProviders/s3Storage'),
    // r2: () => require('./storageProviders/r2Storage'),
    // local: () => require('./storageProviders/localStorage'),
};

class StorageService {
    getProvider() {
        const providerName = process.env.STORAGE_PROVIDER || 'cloudinary';
        const providerLoader = providers[providerName];

        if (!providerLoader) {
            throw new Error(`Unsupported STORAGE_PROVIDER: ${providerName}`);
        }

        return providerLoader();
    }

    async upload(fileBuffer, options = {}) {
        try {
            return await this.getProvider().upload(fileBuffer, options);
        } catch (err) {
            logger.logException('storageService - upload: Exception while uploading file', err);
            throw err;
        }
    }

    async delete(publicId) {
        try {
            return await this.getProvider().delete(publicId);
        } catch (err) {
            logger.logException('storageService - delete: Exception while deleting file', err);
            throw err;
        }
    }
}

module.exports = new StorageService();