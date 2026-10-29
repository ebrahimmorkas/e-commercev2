const CompanyMaster = require('../models/CompanyMaster');
const storageProviderConfig = require('../config/storageProviderConfig');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    STORAGE_PROVIDERS,
    VALID_STORAGE_AREAS,
    CREDENTIAL_PROVIDERS,
    PROVIDER_CREDENTIAL_FIELDS,
    PROVIDER_LABELS,
    AREA_LABELS,
    AREA_SERVICE_FIELDS,
    CREDENTIAL_SOURCES
} = require('../constants/storageConstants');

/*
|--------------------------------------------------------------------------
| PER-VENDOR STORAGE ACCOUNTS
|--------------------------------------------------------------------------
| Every vendor uploads images, videos and files to their OWN Cloudinary /
| S3 / R2 / ImageKit account, saved encrypted in CompanyMaster.storageCredentials
| (select: false - see models/CompanyMaster). This service is the ONLY place
| those credentials are read and decrypted, and the decrypted values only
| ever go straight into a provider call - never into a response, the Redis /
| in-memory vendor cache, or a log.
|
| Which account an upload goes to (resolveUploadTarget):
|   - provider = WebsiteMaster.main<Area>Service when enforce<Area> is on,
|     else the vendor's own <area>Service, else main<Area>Service;
|   - the provider is the vendor's own <area>Service -> the vendor's own
|     account. Not set up -> the upload is refused with a message telling the
|     vendor their account has not been set up (no silent fallback);
|   - otherwise (the platform forced a different provider on them, or they
|     have no own service for this area) -> the platform's .env account.
|
| Which account an existing file is in (resolveAssetCredentials): the one
| whose id equals the asset's storageAccount.
*/

const getProviderLabel = (provider) => {
    try {
        return PROVIDER_LABELS[provider] || provider;
    } catch (err) {
        throw err;
    }
};

// True when every field this provider needs has a value.
const isAccountComplete = (provider, credentials) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields || !credentials) return false;
        return fields.required.every((field) => typeof credentials[field] === 'string' && credentials[field].trim() !== '');
    } catch (err) {
        throw err;
    }
};

// Name a field is stored under: secrets as encrypted<Field>, the rest as-is.
const getStoredFieldName = (provider, field) => {
    try {
        return PROVIDER_CREDENTIAL_FIELDS[provider].encrypted.includes(field)
            ? `encrypted${field.charAt(0).toUpperCase()}${field.slice(1)}`
            : field;
    } catch (err) {
        throw err;
    }
};

// Same as isAccountComplete, for a stored (still encrypted) account - checks
// presence only, without decrypting anything.
const isStoredAccountComplete = (provider, storedAccount) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields || !storedAccount) return false;
        return fields.required.every((field) => {
            const value = storedAccount[getStoredFieldName(provider, field)];
            return typeof value === 'string' && value.trim() !== '';
        });
    } catch (err) {
        throw err;
    }
};

// The non-secret identity of an account - which cloud / bucket a file is in.
// Stored on every ImageAsset / VideoAsset / FileAsset as storageAccount.
const buildStorageAccountId = (provider, credentials) => {
    try {
        if (provider === STORAGE_PROVIDERS.LOCAL) return STORAGE_PROVIDERS.LOCAL;
        if (!credentials) return null;
        if (provider === STORAGE_PROVIDERS.CLOUDINARY) return `cloudinary:${credentials.cloudName}`;
        if (provider === STORAGE_PROVIDERS.AWS) return `aws:${credentials.region}:${credentials.bucket}`;
        if (provider === STORAGE_PROVIDERS.R2) return `r2:${credentials.accountId}:${credentials.bucket}`;
        // The endpoint without https:// and trailing slash, e.g. imagekit:ik.imagekit.io/<imagekitId>
        if (provider === STORAGE_PROVIDERS.IMAGEKIT) {
            const endpoint = String(credentials.urlEndpoint || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
            return endpoint ? `imagekit:${endpoint.toLowerCase()}` : null;
        }
        return null;
    } catch (err) {
        throw err;
    }
};

// local's "credentials" are just where on disk files go and how they're served.
const getLocalCredentials = () => {
    try {
        return { basePath: storageProviderConfig.local.basePath, baseUrl: storageProviderConfig.local.baseUrl };
    } catch (err) {
        throw err;
    }
};

// The platform's .env account for a provider, or null when .env doesn't hold
// a complete one.
const getPlatformAccount = (provider) => {
    try {
        if (provider === STORAGE_PROVIDERS.LOCAL) return getLocalCredentials();
        const credentials = storageProviderConfig[provider];
        return isAccountComplete(provider, credentials) ? { ...credentials } : null;
    } catch (err) {
        throw err;
    }
};

// Plain-text account (validated by storageCredentialsValidations) -> the shape
// stored in CompanyMaster.storageCredentials.<area>.<provider>, with every
// secret encrypted. accountEmail / notes (ACCOUNT_REFERENCE_FIELDS) are kept
// as-is. Used by utils/storageCredentialsFile.js.
const encryptAccount = (provider, plainCredentials) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields) {
            throw new Error(`Unsupported storage provider: ${provider}`);
        }

        const stored = {};
        Object.keys(plainCredentials).forEach((field) => {
            const value = plainCredentials[field];
            if (value === undefined || value === null || value === '') return;
            stored[getStoredFieldName(provider, field)] = fields.encrypted.includes(field) ? common.encryptSecret(value) : value;
        });
        return stored;
    } catch (err) {
        throw err;
    }
};

// Reverse of encryptAccount: stored account -> plain-text credentials.
const decryptAccount = (provider, storedAccount) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields || !storedAccount) return null;

        // Every field the provider knows, required or optional (e.g. R2 endpoint).
        const knownFields = [...new Set([...fields.required, ...fields.encrypted, ...(fields.optional || [])])];
        const credentials = {};
        knownFields.forEach((field) => {
            const storedValue = storedAccount[getStoredFieldName(provider, field)];
            if (storedValue === undefined || storedValue === null || storedValue === '') return;
            credentials[field] = fields.encrypted.includes(field) ? common.decryptSecret(storedValue) : storedValue;
        });
        return credentials;
    } catch (err) {
        throw err;
    }
};

// The vendor's own stored (still encrypted) storage credentials, straight
// from the DB - never from the vendor cache, which does not hold them.
const fetchStoredVendorCredentials = async (vendorId) => {
    try {
        const companyMaster = await CompanyMaster.findOne({ vendorId }).select('+storageCredentials').lean();
        return (companyMaster && companyMaster.storageCredentials) || {};
    } catch (err) {
        throw err;
    }
};

// The vendor's own decrypted account for one area + provider, or null when it
// isn't (completely) set up.
const getVendorAccount = (storedCredentials, area, provider) => {
    try {
        const storedAccount = storedCredentials && storedCredentials[area] && storedCredentials[area][provider];
        if (!storedAccount) return null;
        const credentials = decryptAccount(provider, storedAccount);
        return isAccountComplete(provider, credentials) ? credentials : null;
    } catch (err) {
        throw err;
    }
};

// Which provider + account a new upload in this area goes to - see the rules
// at the top of this file. Success meta: { provider, credentials, storageAccount, source }.
const resolveUploadTarget = async ({ area, vendorId, companyMasterData, websiteMasterData }) => {
    try {
        const serviceFields = AREA_SERVICE_FIELDS[area];
        if (!serviceFields) {
            throw new Error(`Unsupported storage area: ${area}`);
        }

        const vendorService = (companyMasterData && companyMasterData[serviceFields.vendorService]) || null;
        const mainService = (websiteMasterData && websiteMasterData[serviceFields.mainService]) || null;
        const isEnforced = !!(websiteMasterData && websiteMasterData[serviceFields.enforce] === true);
        const provider = isEnforced ? mainService : (vendorService || mainService);
        const areaLabel = AREA_LABELS[area];

        if (!provider) {
            return common.returnResult(false, 400, `No ${areaLabel} storage provider configured for this vendor.`);
        }

        if (provider === STORAGE_PROVIDERS.LOCAL) {
            return common.returnResult(true, 200, 'Storage account resolved', {
                provider,
                credentials: getLocalCredentials(),
                storageAccount: STORAGE_PROVIDERS.LOCAL,
                source: CREDENTIAL_SOURCES.PLATFORM
            });
        }

        if (!CREDENTIAL_PROVIDERS.includes(provider)) {
            return common.returnResult(false, 400, `Unsupported ${areaLabel} storage provider: ${provider}.`);
        }

        const providerLabel = getProviderLabel(provider);

        if (provider === vendorService) {
            const storedCredentials = await fetchStoredVendorCredentials(vendorId);
            const credentials = getVendorAccount(storedCredentials, area, provider);
            if (!credentials) {
                logger.logInfo(0, 1, 'Vendor storage account not set up', { vendorId, area, provider });
                return common.returnResult(false, 400, `Your ${providerLabel} account for ${areaLabel} uploads has not been set up yet. Please contact the website administrator.`);
            }
            return common.returnResult(true, 200, 'Storage account resolved', {
                provider,
                credentials,
                storageAccount: buildStorageAccountId(provider, credentials),
                source: CREDENTIAL_SOURCES.VENDOR
            });
        }

        const credentials = getPlatformAccount(provider);
        if (!credentials) {
            logger.logInfo(0, 1, 'Platform storage account not set up in .env', { vendorId, area, provider });
            return common.returnResult(false, 400, `${providerLabel} storage for ${areaLabel} uploads has not been set up on this website yet. Please contact the website administrator.`);
        }
        return common.returnResult(true, 200, 'Storage account resolved', {
            provider,
            credentials,
            storageAccount: buildStorageAccountId(provider, credentials),
            source: CREDENTIAL_SOURCES.PLATFORM
        });
    } catch (err) {
        throw err;
    }
};

// Credentials for the account an existing asset is stored in, to delete it.
// Checks, in order: the vendor's own account for this area, the vendor's
// accounts of the same provider in the other areas, then the platform's .env
// account - and uses the first whose id matches asset.storageAccount. An
// asset with no storageAccount predates per-vendor accounts and is in the
// .env account. Returns null when no known account holds the file any more
// (e.g. the vendor's credentials were changed to a new account since).
const resolveAssetCredentials = async ({ area, asset }) => {
    try {
        const provider = asset.provider;
        if (provider === STORAGE_PROVIDERS.LOCAL) return getLocalCredentials();
        if (!CREDENTIAL_PROVIDERS.includes(provider)) return null;

        if (!asset.storageAccount) return getPlatformAccount(provider);

        const storedCredentials = await fetchStoredVendorCredentials(asset.vendorId);
        const areasToCheck = [area, ...VALID_STORAGE_AREAS.filter((otherArea) => otherArea !== area)];
        for (const candidateArea of areasToCheck) {
            const credentials = getVendorAccount(storedCredentials, candidateArea, provider);
            if (credentials && buildStorageAccountId(provider, credentials) === asset.storageAccount) {
                return credentials;
            }
        }

        const platformCredentials = getPlatformAccount(provider);
        if (platformCredentials && buildStorageAccountId(provider, platformCredentials) === asset.storageAccount) {
            return platformCredentials;
        }

        return null;
    } catch (err) {
        throw err;
    }
};

// Removes an asset's file from the account that holds it. getProvider is the
// area's provider factory (images / videos / files have their own adapters).
// When no known account holds the file any more, it is left where it is and
// logged instead of failing - the caller's delete/replace still goes ahead.
const deleteStoredAsset = async ({ area, asset, getProvider }) => {
    try {
        const credentials = await resolveAssetCredentials({ area, asset });
        if (!credentials) {
            logger.logWarning('storageCredentialsService - deleteStoredAsset: no storage account holds this file any more, so it was left in place', {
                assetId: asset._id,
                vendorId: asset.vendorId,
                area,
                provider: asset.provider,
                storageAccount: asset.storageAccount
            });
            return false;
        }

        await getProvider(asset.provider).delete(asset.key, credentials);
        return true;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isAccountComplete,
    isStoredAccountComplete,
    buildStorageAccountId,
    encryptAccount,
    resolveUploadTarget,
    resolveAssetCredentials,
    deleteStoredAsset
};
