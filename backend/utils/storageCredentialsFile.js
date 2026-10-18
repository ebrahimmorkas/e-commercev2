const fs = require('fs');
const path = require('path');
const CompanyMaster = require('../models/CompanyMaster');
const storageCredentialsService = require('../services/storageCredentialsService');
const { storageCredentialsSchema } = require('../middlewares/validations/storageCredentialsValidations');
const { AREA_SERVICE_FIELDS, CREDENTIAL_PROVIDERS } = require('../constants/storageConstants');

// Shared by seeds/seedCompanyMaster.js and
// scripts/manageVendorStorageCredentials.js - the only two ways a vendor's
// storage accounts (CompanyMaster.storageCredentials) are written.

const STORAGE_CREDENTIALS_FILE = path.join(__dirname, '..', 'seeds', 'private', 'storageCredentials.json');

// Reads, validates and encrypts the credentials file.
// Returns the $set entries ({ 'storageCredentials.image.cloudinary': {...} })
// or null when the file does not exist.
function loadStorageCredentialUpdates(filePath = STORAGE_CREDENTIALS_FILE) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        // A missing / malformed key would make common.js fall back to a random
        // per-process key, and the server could never decrypt what is saved.
        if (!/^[0-9a-fA-F]{64}$/.test(process.env.CREDENTIALS_ENCRYPTION_KEY || '')) {
            throw new Error('CREDENTIALS_ENCRYPTION_KEY in .env must be set to 64 hex characters (the same key the server uses) before saving storage credentials.');
        }

        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (parseError) {
            throw new Error(`${filePath} is not valid JSON.`);
        }

        const { error, value } = storageCredentialsSchema.validate(parsed, {
            abortEarly: false,
            errors: { wrap: { label: false } }
        });
        if (error) {
            const details = error.details.map((detail) => `  - ${detail.path.join('.')}: ${detail.message.replace(/"/g, '')}`).join('\n');
            throw new Error(`Invalid storage credentials in ${filePath}:\n${details}`);
        }

        const updates = {};
        Object.keys(value).forEach((area) => {
            Object.keys(value[area]).forEach((provider) => {
                updates[`storageCredentials.${area}.${provider}`] = storageCredentialsService.encryptAccount(provider, value[area][provider]);
            });
        });
        return updates;
    } catch (error) {
        throw error;
    }
}

// Which saved account each area will use - account id (cloud name / bucket),
// the reference accountEmail and notes, never a secret - plus a warning for
// every area whose provider has no complete account yet.
async function describeStorageAccounts(vendorId) {
    try {
        const saved = await CompanyMaster.findOne({ vendorId }).select('+storageCredentials').lean();
        if (!saved) {
            return '  no CompanyMaster for this vendor';
        }
        const credentials = saved.storageCredentials || {};
        const lines = [];

        Object.keys(AREA_SERVICE_FIELDS).forEach((area) => {
            const service = saved[AREA_SERVICE_FIELDS[area].vendorService];
            if (!service) {
                lines.push(`  ${area}: not set -> the website's default provider with the website's own .env account`);
                return;
            }
            if (!CREDENTIAL_PROVIDERS.includes(service)) {
                lines.push(`  ${area}: ${service} (no account needed)`);
                return;
            }

            const stored = credentials[area] && credentials[area][service];
            if (!storageCredentialsService.isStoredAccountComplete(service, stored)) {
                lines.push(`  ${area}: ${service} -> WARNING: no account saved, ${area} uploads will be refused`);
                return;
            }
            lines.push(`  ${area}: ${service} -> ${storageCredentialsService.buildStorageAccountId(service, stored)}`);
            lines.push(stored.accountEmail
                ? `      account email: ${stored.accountEmail}`
                : '      account email: NOT RECORDED - re-save this account with its accountEmail');
            if (stored.notes) lines.push(`      notes: ${stored.notes.replace(/\s*\n\s*/g, ' / ')}`);
        });

        return lines.join('\n');
    } catch (error) {
        throw error;
    }
}

module.exports = {
    STORAGE_CREDENTIALS_FILE,
    loadStorageCredentialUpdates,
    describeStorageAccounts
};
