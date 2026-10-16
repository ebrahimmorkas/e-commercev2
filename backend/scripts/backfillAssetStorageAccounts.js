// One-time (safe to re-run) backfill: fills ImageAsset / VideoAsset /
// FileAsset.storageAccount for files uploaded before per-vendor storage
// accounts existed (see services/storageCredentialsService.js).
//
// Not strictly required - an asset with no storageAccount is treated as being
// in the platform's .env account - but once filled in, such a file can also
// be deleted with the vendor's own credentials for the same account, so it
// keeps working even if the .env account is later removed.
//
// The account is read from the file's own URL, never assumed:
//   cloudinary  https://res.cloudinary.com/<cloudName>/...         -> cloudinary:<cloudName>
//   aws         https://<bucket>.s3.<region>.amazonaws.com/...      -> aws:<region>:<bucket>
//   r2          URL starts with the .env R2_PUBLIC_URL               -> r2:<accountId>:<bucket> (.env)
//   local                                                            -> local
// An asset whose URL matches none of these is left as it is and reported.
//
// Dry run by default (prints what it would change); --apply writes.
// Run:  node scripts/backfillAssetStorageAccounts.js [--apply]
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const ImageAsset = require('../models/ImageAsset');
const VideoAsset = require('../models/VideoAsset');
const FileAsset = require('../models/FileAsset');
const storageProviderConfig = require('../config/storageProviderConfig');
const storageCredentialsService = require('../services/storageCredentialsService');
const { STORAGE_PROVIDERS } = require('../constants/storageConstants');

const MODELS = { ImageAsset, VideoAsset, FileAsset };

const CLOUDINARY_URL = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\//i;
const AWS_URL = /^https?:\/\/([^/]+)\.s3\.([a-z0-9-]+)\.amazonaws\.com\//i;

function deriveStorageAccount(asset) {
    try {
        const url = String(asset.url || '');

        if (asset.provider === STORAGE_PROVIDERS.LOCAL) return STORAGE_PROVIDERS.LOCAL;

        if (asset.provider === STORAGE_PROVIDERS.CLOUDINARY) {
            const match = CLOUDINARY_URL.exec(url);
            return match ? storageCredentialsService.buildStorageAccountId(asset.provider, { cloudName: match[1] }) : null;
        }

        if (asset.provider === STORAGE_PROVIDERS.AWS) {
            const match = AWS_URL.exec(url);
            return match ? storageCredentialsService.buildStorageAccountId(asset.provider, { bucket: match[1], region: match[2] }) : null;
        }

        if (asset.provider === STORAGE_PROVIDERS.R2) {
            const r2 = storageProviderConfig.r2;
            const publicUrl = String(r2.publicUrl || '').replace(/\/+$/, '');
            const isEnvAccount = publicUrl && r2.accountId && r2.bucket && url.startsWith(`${publicUrl}/`);
            return isEnvAccount ? storageCredentialsService.buildStorageAccountId(asset.provider, r2) : null;
        }

        return null;
    } catch (error) {
        throw error;
    }
}

async function backfillAssetStorageAccounts() {
    try {
        const apply = process.argv.includes('--apply');
        await mongoose.connect(process.env.MONGODB_URI);

        for (const [name, Model] of Object.entries(MODELS)) {
            const assets = await Model.find({ $or: [{ storageAccount: null }, { storageAccount: { $exists: false } }] })
                .select('_id vendorId provider url')
                .lean();

            const byAccount = {};
            const operations = [];
            let unmatched = 0;

            for (const asset of assets) {
                const storageAccount = deriveStorageAccount(asset);
                if (!storageAccount) {
                    unmatched++;
                    process.stdout.write(`  ${name} ${asset._id}: account not recognised from its URL, left unchanged (${asset.provider})\n`);
                    continue;
                }
                byAccount[storageAccount] = (byAccount[storageAccount] || 0) + 1;
                operations.push({ updateOne: { filter: { _id: asset._id }, update: { $set: { storageAccount } } } });
            }

            if (apply && operations.length > 0) {
                await Model.bulkWrite(operations, { ordered: false });
            }

            const summary = Object.entries(byAccount).map(([account, count]) => `${account}: ${count}`).join(', ') || 'nothing to change';
            process.stdout.write(`${name}: ${operations.length} ${apply ? 'updated' : 'would be updated'} (${summary}), ${unmatched} unrecognised.\n`);
        }

        if (!apply) process.stdout.write('Dry run - re-run with --apply to write.\n');
        await mongoose.connection.close();
    } catch (error) {
        process.stderr.write(`backfillAssetStorageAccounts failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exitCode = 1;
    }
}

backfillAssetStorageAccounts();
