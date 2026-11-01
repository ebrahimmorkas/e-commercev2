const fs = require('fs/promises');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const storageProviderConfig = require('../config/storageProviderConfig');
const { STORAGE_PROVIDERS, STORAGE_AREAS } = require('../constants/storageConstants');
const storageCredentialsService = require('./storageCredentialsService');
const { accountOptions } = require('./providers/cloudinaryProvider');

// Reads a stored file's bytes back (an ImageAsset or FileAsset), e.g. to
// attach it to an email or serve the catalogue download. Local files come
// straight from disk; S3/R2/Cloudinary/ImageKit files are fetched from their
// public URL.
const FETCH_TIMEOUT_MS = 20000;

// Cloudinary refuses public delivery of PDF/ZIP (and on some accounts all
// 'raw') files unless the account allows it - the URL answers 401 "deny or ACL
// failure". The signed Admin download API isn't subject to that, so a refused
// Cloudinary file is fetched through it with the account that holds the file.
const CLOUDINARY_RESOURCE_TYPE_TO_AREA = {
    raw: STORAGE_AREAS.FILE,
    image: STORAGE_AREAS.IMAGE,
    video: STORAGE_AREAS.VIDEO
};

// .../<cloud>/<resource_type>/upload/... -> resource_type (raw for FileAssets).
const getCloudinaryResourceType = (url) => {
    try {
        const match = /res\.cloudinary\.com\/[^/]+\/(raw|image|video)\//.exec(url || '');
        return match ? match[1] : 'raw';
    } catch (err) {
        throw err;
    }
};

const fetchBytes = async (url) => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        return { ok: response.ok, status: response.status, buffer: response.ok ? Buffer.from(await response.arrayBuffer()) : null };
    } catch (err) {
        throw err;
    }
};

const readCloudinaryAssetSigned = async (asset) => {
    try {
        const resourceType = getCloudinaryResourceType(asset.url);
        const credentials = await storageCredentialsService.resolveAssetCredentials({
            area: CLOUDINARY_RESOURCE_TYPE_TO_AREA[resourceType],
            asset
        });
        if (!credentials) {
            throw new Error(`No Cloudinary account holds ${asset.url} any more`);
        }
        const signedUrl = cloudinary.utils.private_download_url(asset.key, '', {
            ...accountOptions(credentials),
            resource_type: resourceType,
            type: 'upload'
        });
        const result = await fetchBytes(signedUrl);
        if (!result.ok) {
            throw new Error(`Could not download ${asset.url} through the Cloudinary API (HTTP ${result.status})`);
        }
        return result.buffer;
    } catch (err) {
        throw err;
    }
};

const readStoredAsset = async (asset) => {
    try {
        if (asset.provider === STORAGE_PROVIDERS.LOCAL) {
            const { basePath } = storageProviderConfig.local;
            return await fs.readFile(path.join(basePath, asset.key));
        }
        const result = await fetchBytes(asset.url);
        if (result.ok) {
            return result.buffer;
        }
        if (asset.provider === STORAGE_PROVIDERS.CLOUDINARY) {
            return await readCloudinaryAssetSigned(asset);
        }
        throw new Error(`Could not download ${asset.url} (HTTP ${result.status})`);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    readStoredAsset
};
