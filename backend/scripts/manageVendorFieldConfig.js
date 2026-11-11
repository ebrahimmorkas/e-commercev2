// Saves / shows / removes ONE vendor's field configuration (models/VendorFieldConfig.js):
// which built-in fields the vendor does not want to see, what some fields are
// called for them, and the extra fields of their own they want added. The
// vendor is picked by domain. See constants/fieldConfigConstants.js for which
// fields can be hidden/renamed and what a hidden field does in the background.
//
// set: write the config in a JSON file - see seeds/fieldConfigs/example.json:
//   { "<entity>": { "hiddenFields": [...], "labelOverrides": [...], "customFields": [...] } }
// Each entity in the file REPLACES that entity's saved config completely;
// entities not in the file are left as they are. The file is validated
// against the field registry before anything is saved.
// view:   prints the saved config of every entity.
// remove: deletes one entity's config - the vendor gets the standard fields back.
//
// A custom field's key is where its values are stored - never change the key of
// a field that already has values (change its label instead). Values of a
// custom field removed from the config stay in the DB but are no longer shown,
// and are dropped the next time that product is saved.
//
// The config is cached in Redis (field-config:<vendorId>, 1h). This script
// clears that key when Redis is on, so no restart is needed.
//
// Usage:
//   node scripts/manageVendorFieldConfig.js set <domain> <jsonFile>
//   node scripts/manageVendorFieldConfig.js view <domain>
//   node scripts/manageVendorFieldConfig.js remove <domain> <entity>
// Against another environment's DB, e.g. stage on Render:
//   node --env-file=.env.render scripts/manageVendorFieldConfig.js set <domain> <jsonFile>
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const VendorFieldConfig = require('../models/VendorFieldConfig');
const { connectRedis, closeRedis } = require('../config/redisConfig');
const fieldConfigService = require('../services/fieldConfigService');
const { vendorFieldConfigFileSchema } = require('../middlewares/validations/fieldConfigValidations');
const { FIELD_REGISTRY } = require('../constants/fieldConfigConstants');

const COMMANDS = ['set', 'view', 'remove'];
const USAGE = 'Usage: node scripts/manageVendorFieldConfig.js set <domain> <jsonFile> | view <domain> | remove <domain> <entity>';

// The JSON file, validated (and defaults filled in) before the DB is touched.
const loadConfigFile = (filePath) => {
    try {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`${absolutePath} not found.`);
        }
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        } catch (parseError) {
            throw new Error(`${absolutePath} is not valid JSON: ${parseError.message}`);
        }
        const { error, value } = vendorFieldConfigFileSchema.validate(parsed, { abortEarly: false, errors: { wrap: { label: false } } });
        if (error) {
            throw new Error(`The config file is not valid:\n - ${error.details.map((d) => `${d.path.join('.')}: ${d.message}`).join('\n - ')}`);
        }
        return value;
    } catch (err) {
        throw err;
    }
};

const describeConfig = async (vendorId) => {
    try {
        const config = await fieldConfigService.fetchVendorFieldConfig(vendorId);
        const entities = Object.keys(config);
        if (entities.length === 0) return '  (none - the standard fields are used everywhere)';

        const lines = [];
        for (const entity of entities) {
            const { hiddenFields, labelOverrides, customFields } = config[entity];
            lines.push(`  ${entity}:`);
            lines.push(`    hidden fields:   ${hiddenFields.length ? hiddenFields.join(', ') : '-'}`);
            const renames = Object.entries(labelOverrides).map(([field, label]) => `${field} -> "${label}"`);
            lines.push(`    renamed fields:  ${renames.length ? renames.join(', ') : '-'}`);
            lines.push(`    custom fields:   ${customFields.length ? '' : '-'}`);
            for (const cf of customFields) {
                const where = cf.placement.mode === 'end' ? 'at the end' : `${cf.placement.mode} ${cf.placement.field}`;
                const options = cf.type === 'select' ? ` [${cf.options.join(' | ')}]` : '';
                lines.push(`      - ${cf.key} "${cf.label}" (${cf.type}${options}, ${cf.required ? 'required' : 'optional'}, ${where}${cf.showInAdminLists ? ', shown in admin lists' : ''})`);
            }
        }
        return lines.join('\n');
    } catch (err) {
        throw err;
    }
};

// Best effort: with Redis off there is nothing cached.
const clearCachedConfig = async (vendorId) => {
    try {
        if (process.env.IS_REDIS_SERVER_ON !== '1') return;
        await connectRedis();
        await fieldConfigService.invalidateVendorFieldConfig(vendorId);
    } catch (err) {
        process.stdout.write(`Could not clear the Redis cache (${err.message}) - the old config may be used for up to an hour.\n`);
    }
};

async function run() {
    try {
        const [command, domain, arg] = process.argv.slice(2);
        if (!COMMANDS.includes(command) || !domain || (command !== 'view' && !arg)) {
            throw new Error(USAGE);
        }
        if (command === 'remove' && !FIELD_REGISTRY[arg]) {
            throw new Error(`Unknown entity "${arg}". Known: ${Object.keys(FIELD_REGISTRY).join(', ')}.`);
        }

        const fileConfig = command === 'set' ? loadConfigFile(arg) : null;

        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: domain.trim().toLowerCase() }).select('_id domain').lean();
        if (!vendor) {
            throw new Error(`Vendor ${domain} not found.`);
        }

        if (command === 'set') {
            for (const [entity, config] of Object.entries(fileConfig)) {
                await VendorFieldConfig.findOneAndUpdate(
                    { vendorId: vendor._id, entity, status: { $in: ['A', 'I'] } },
                    {
                        $set: {
                            hiddenFields: config.hiddenFields,
                            labelOverrides: config.labelOverrides,
                            customFields: config.customFields,
                            status: 'A'
                        },
                        $setOnInsert: { vendorId: vendor._id, entity }
                    },
                    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
                );
            }
            await clearCachedConfig(vendor._id);
            process.stdout.write(`Field config saved for ${vendor.domain} (${Object.keys(fileConfig).join(', ')}).\n`);
        }

        if (command === 'remove') {
            const result = await VendorFieldConfig.updateMany(
                { vendorId: vendor._id, entity: arg, status: { $in: ['A', 'I'] } },
                { $set: { status: 'D' } }
            );
            await clearCachedConfig(vendor._id);
            process.stdout.write(result.modifiedCount > 0
                ? `Field config for "${arg}" removed for ${vendor.domain}.\n`
                : `${vendor.domain} had no field config for "${arg}".\n`);
        }

        process.stdout.write(`Field config of ${vendor.domain}:\n${await describeConfig(vendor._id)}\n`);
    } catch (error) {
        process.stderr.write(`manageVendorFieldConfig failed: ${error.message}\n`);
        // exitCode, not process.exit(1): pino (loaded via the logger) throws
        // if the process is killed while it is still starting.
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
        await closeRedis();
    }
}

run();
