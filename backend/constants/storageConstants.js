// Single source of truth for media storage. Each vendor has its OWN storage
// account per area (images, videos, files), saved encrypted in
// CompanyMaster.storageCredentials - see services/storageCredentialsService.js.

// What kind of upload it is. Each area has its own provider choice
// (CompanyMaster.imageService / videoService / fileService) and its own
// credentials, so a vendor can e.g. keep images and videos in different accounts.
const STORAGE_AREAS = {
    IMAGE: 'image',
    VIDEO: 'video',
    FILE: 'file'
};

const VALID_STORAGE_AREAS = Object.values(STORAGE_AREAS);

const STORAGE_PROVIDERS = {
    CLOUDINARY: 'cloudinary',
    AWS: 'aws',
    R2: 'r2',
    LOCAL: 'local'
};

const VALID_STORAGE_PROVIDERS = Object.values(STORAGE_PROVIDERS);

// Providers that need an account (credentials). 'local' writes to this
// server's own disk, so it has none.
const CREDENTIAL_PROVIDERS = [STORAGE_PROVIDERS.CLOUDINARY, STORAGE_PROVIDERS.AWS, STORAGE_PROVIDERS.R2];

// Per provider: every field a complete account needs, and which of them are
// encrypted at rest (common.encryptSecret). The rest are not secret - they
// already appear in every public file URL - and stay readable so an asset can
// be matched back to the account that holds it (see buildStorageAccountId).
const PROVIDER_CREDENTIAL_FIELDS = {
    [STORAGE_PROVIDERS.CLOUDINARY]: {
        required: ['cloudName', 'apiKey', 'apiSecret'],
        encrypted: ['apiKey', 'apiSecret']
    },
    [STORAGE_PROVIDERS.AWS]: {
        required: ['accessKeyId', 'secretAccessKey', 'region', 'bucket'],
        encrypted: ['accessKeyId', 'secretAccessKey']
    },
    [STORAGE_PROVIDERS.R2]: {
        required: ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket', 'publicUrl'],
        encrypted: ['accessKeyId', 'secretAccessKey'],
        // Defaults to https://<accountId>.r2.cloudflarestorage.com when unset.
        optional: ['endpoint']
    }
};

// Saved next to every account for the platform owner's own reference - which
// email the provider account was signed up with, plus free-text notes. Not
// credentials: never passed to a provider and not needed for an account to be
// complete (accounts saved before these existed keep working). accountEmail
// is required whenever an account is saved (storageCredentialsValidations).
const ACCOUNT_REFERENCE_FIELDS = ['accountEmail', 'notes'];

const ACCOUNT_NOTES_MAX_LENGTH = 500;

// Names shown in messages to the vendor.
const PROVIDER_LABELS = {
    [STORAGE_PROVIDERS.CLOUDINARY]: 'Cloudinary',
    [STORAGE_PROVIDERS.AWS]: 'Amazon S3',
    [STORAGE_PROVIDERS.R2]: 'Cloudflare R2',
    [STORAGE_PROVIDERS.LOCAL]: 'Local storage'
};

const AREA_LABELS = {
    [STORAGE_AREAS.IMAGE]: 'image',
    [STORAGE_AREAS.VIDEO]: 'video',
    [STORAGE_AREAS.FILE]: 'file'
};

// Where each area's provider choice lives on CompanyMaster / WebsiteMaster.
const AREA_SERVICE_FIELDS = {
    [STORAGE_AREAS.IMAGE]: { vendorService: 'imageService', mainService: 'mainImageService', enforce: 'enforceMainImageService' },
    [STORAGE_AREAS.VIDEO]: { vendorService: 'videoService', mainService: 'mainVideoService', enforce: 'enforceMainVideoService' },
    [STORAGE_AREAS.FILE]: { vendorService: 'fileService', mainService: 'mainFileService', enforce: 'enforceMainFileService' }
};

// Whose account an upload went to.
//   VENDOR   - the vendor's own account from CompanyMaster.storageCredentials
//   PLATFORM - the website owner's account from .env
const CREDENTIAL_SOURCES = {
    VENDOR: 'vendor',
    PLATFORM: 'platform'
};

const VALID_CREDENTIAL_SOURCES = Object.values(CREDENTIAL_SOURCES);

module.exports = {
    STORAGE_AREAS,
    VALID_STORAGE_AREAS,
    STORAGE_PROVIDERS,
    VALID_STORAGE_PROVIDERS,
    CREDENTIAL_PROVIDERS,
    PROVIDER_CREDENTIAL_FIELDS,
    ACCOUNT_REFERENCE_FIELDS,
    ACCOUNT_NOTES_MAX_LENGTH,
    PROVIDER_LABELS,
    AREA_LABELS,
    AREA_SERVICE_FIELDS,
    CREDENTIAL_SOURCES,
    VALID_CREDENTIAL_SOURCES
};
