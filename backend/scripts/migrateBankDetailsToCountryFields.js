// One-time (safe to re-run) migration to per-country bank fields.
//
// 1. Every CompanySettings that still has the old fixed bank fields
//    (bankAccountHolderName, bankName, bankAccountNumber, ifscCode,
//    branchName, swiftCode, bankAccountType) gets them copied into
//    bankDetails, under its STORE country, keyed by that country's template
//    fields; the old fields are then removed.
//      - old ifscCode goes to the template's "ifscCode" field, else to its
//        "iban" field (UAE vendors had been typing the IBAN into the IFSC box);
//      - a value whose field the template doesn't have is still kept (stored,
//        not shown) and listed in the report;
//      - a vendor with no store country, or whose store country has no
//        template, is skipped (old fields untouched) - set it up and re-run;
//      - a vendor that already has bank details for that country is skipped.
//    Values that don't meet the template's rules (e.g. an IFSC in the wrong
//    format) are still moved, and listed - the vendor has to correct them the
//    next time they save Payment & Bank.
// 2. Removes the temporary "rename the IFSC field" field configs
//    (VendorFieldConfig, entity "companySettings") - that feature is gone.
//
// Run seeds/seedBankFieldTemplates.js first.
// Run:  node scripts/migrateBankDetailsToCountryFields.js           (dry run - changes nothing)
//       node scripts/migrateBankDetailsToCountryFields.js --apply   (migrates)
// Against another environment's DB, e.g. stage on Render:
//       node --env-file=.env.render scripts/migrateBankDetailsToCountryFields.js [--apply]
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const CompanySettings = require('../models/CompanySettings');
const VendorFieldConfig = require('../models/VendorFieldConfig');
const Vendor = require('../models/Vendor');
const bankFieldTemplateService = require('../services/bankFieldTemplateService');
const { connectRedis, closeRedis } = require('../config/redisConfig');
const redisService = require('../services/redisService');
const redisKeys = require('../utils/redisKeys');

const APPLY = process.argv.includes('--apply');

// old CompanySettings field -> template keys it can go to (first one the template has wins)
const LEGACY_FIELD_TARGETS = {
    bankAccountHolderName: ['accountHolderName'],
    bankName: ['bankName'],
    bankAccountNumber: ['accountNumber'],
    ifscCode: ['ifscCode', 'iban'],
    branchName: ['branchName'],
    swiftCode: ['swiftCode'],
    bankAccountType: ['accountType']
};
const LEGACY_FIELDS = Object.keys(LEGACY_FIELD_TARGETS);
const OLD_FIELD_CONFIG_ENTITY = 'companySettings';

const isFilled = (value) => value !== null && value !== undefined && String(value).trim() !== '';

// Best effort: with Redis off there is nothing cached.
const clearCache = async (keys) => {
    try {
        if (process.env.IS_REDIS_SERVER_ON !== '1' || keys.length === 0) return;
        await connectRedis();
        for (const key of keys) {
            await redisService.del(key);
        }
    } catch (err) {
        console.log(`Could not clear the Redis cache (${err.message}) - old data may be served for up to an hour.`);
    }
};

async function migrateBankDetailsToCountryFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const collection = CompanySettings.collection;
        const vendorDomains = new Map((await Vendor.find({}).select('_id domain').lean()).map((v) => [String(v._id), v.domain]));
        const cacheKeys = [];
        let migrated = 0;
        let skipped = 0;

        // Raw collection: the model no longer has the old fields.
        const docs = await collection.find({ $or: LEGACY_FIELDS.map((field) => ({ [field]: { $exists: true } })) }).toArray();

        for (const doc of docs) {
            const who = vendorDomains.get(String(doc.vendorId)) || String(doc.vendorId);
            const legacy = Object.fromEntries(LEGACY_FIELDS.filter((field) => isFilled(doc[field])).map((field) => [field, String(doc[field]).trim()]));

            if (Object.keys(legacy).length === 0) {
                // Only empty old fields - just remove them.
                if (APPLY) await collection.updateOne({ _id: doc._id }, { $unset: Object.fromEntries(LEGACY_FIELDS.map((field) => [field, ''])) });
                console.log(`${who}: no bank details filled in - ${APPLY ? 'removed' : 'would remove'} the empty old fields.`);
                continue;
            }

            if (!doc.storeCountryId) {
                skipped += 1;
                console.log(`${who}: SKIPPED - no store country set. Set it and re-run. Old values: ${JSON.stringify(legacy)}`);
                continue;
            }

            const { country, fields } = await bankFieldTemplateService.fetchActiveFieldsForCountry(doc.storeCountryId);
            const countryName = country?.name || String(doc.storeCountryId);
            if (fields.length === 0) {
                skipped += 1;
                console.log(`${who}: SKIPPED - no bank field template for ${countryName}. Create it and re-run.`);
                continue;
            }

            const alreadyHas = (doc.bankDetails || []).some((entry) => String(entry.countryId) === String(doc.storeCountryId)
                && (entry.values || []).some((item) => isFilled(item.value)));
            if (alreadyHas) {
                skipped += 1;
                console.log(`${who}: SKIPPED - already has bank details for ${countryName}; the old fields are left as they are.`);
                continue;
            }

            const templateKeys = new Set(fields.map((field) => field.key));
            const values = {};
            const notInTemplate = [];
            for (const [legacyField, value] of Object.entries(legacy)) {
                const targets = LEGACY_FIELD_TARGETS[legacyField];
                const key = targets.find((target) => templateKeys.has(target)) || targets[0];
                values[key] = value;
                if (!templateKeys.has(key)) notInTemplate.push(`${legacyField} -> ${key}`);
            }

            // Report only - the values are moved as they are.
            const check = bankFieldTemplateService.validateBankDetailValues(fields, Object.fromEntries(
                Object.entries(values).filter(([key]) => templateKeys.has(key))
            ));

            const bankDetails = bankFieldTemplateService.mergeCountryValues(doc.bankDetails, doc.storeCountryId, values);
            if (APPLY) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { bankDetails }, $unset: Object.fromEntries(LEGACY_FIELDS.map((field) => [field, ''])) }
                );
                cacheKeys.push(redisKeys.companySettings(doc.vendorId));
            }
            migrated += 1;
            console.log(`${who}: ${APPLY ? 'moved' : 'would move'} ${Object.keys(values).length} value(s) to ${countryName}: ${JSON.stringify(values)}`);
            if (notInTemplate.length > 0) {
                console.log(`    kept but not shown (the ${countryName} template has no such field): ${notInTemplate.join(', ')}`);
            }
            if (!check.isSuccess) {
                console.log(`    NOTE: ${check.message} - the vendor must correct it on their next save of Payment & Bank.`);
            }
        }

        // 2. The temporary IFSC rename configs.
        const oldConfigs = await VendorFieldConfig.find({ entity: OLD_FIELD_CONFIG_ENTITY }).select('_id vendorId labelOverrides').lean();
        for (const config of oldConfigs) {
            const who = vendorDomains.get(String(config.vendorId)) || String(config.vendorId);
            console.log(`${who}: ${APPLY ? 'removed' : 'would remove'} the old "${OLD_FIELD_CONFIG_ENTITY}" field config ${JSON.stringify(config.labelOverrides || [])}.`);
            cacheKeys.push(redisKeys.fieldConfig(config.vendorId));
        }
        if (APPLY && oldConfigs.length > 0) {
            await VendorFieldConfig.deleteMany({ _id: { $in: oldConfigs.map((config) => config._id) } });
        }

        if (APPLY) await clearCache(cacheKeys);

        console.log(`\n${APPLY ? 'Migrated' : 'Would migrate'} ${migrated} vendor(s), skipped ${skipped}; ${oldConfigs.length} old field config(s).`);
        if (!APPLY) {
            console.log('Dry run only - nothing was changed. Re-run with --apply to migrate.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        await closeRedis().catch(() => {});
    }
}

migrateBankDetailsToCountryFields();
