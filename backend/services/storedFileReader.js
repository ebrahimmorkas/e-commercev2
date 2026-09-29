const fs = require('fs/promises');
const path = require('path');
const imageProviderConfig = require('../config/imageProviderConfig');

// Reads a stored file's bytes back (an ImageAsset or FileAsset), e.g. to
// attach it to an email. Local files come straight from disk; S3/R2/
// Cloudinary files are fetched from their public URL.
const FETCH_TIMEOUT_MS = 20000;

const readStoredAsset = async (asset) => {
    try {
        if (asset.provider === 'local') {
            const { basePath } = imageProviderConfig.local;
            return await fs.readFile(path.join(basePath, asset.key));
        }
        const response = await fetch(asset.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) {
            throw new Error(`Could not download ${asset.url} (HTTP ${response.status})`);
        }
        return Buffer.from(await response.arrayBuffer());
    } catch (err) {
        throw err;
    }
};

module.exports = {
    readStoredAsset
};
