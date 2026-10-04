// migrations/resinArts/01-setup.js
//
// Step 1 of the resinArts migration - run once per database before the others.
//
// The old products had no sizes. Every migrated product gets one variant with
// one size, and that size has to point at a SizeMaster entry the vendor's plan
// allows. This creates that entry ("Standard", a LABEL size with the single
// value "Standard") and adds it to the vendor's CompanyMaster.allowedSizes.
//
//   node migrations/resinArts/01-setup.js --vendor localhost            (dry run)
//   node migrations/resinArts/01-setup.js --vendor localhost --apply
//
// Safe to re-run: the size is matched by name and only ever added.

const SizeMaster = require('../../models/SizeMaster');
const CompanyMaster = require('../../models/CompanyMaster');
const redisKeys = require('../../utils/redisKeys');
const config = require('./config');
const { openContext, invalidateCache, run } = require('./lib/runtime');

const main = async () => {
    try {
        const ctx = await openContext('01-setup: Standard size');
        const { args, vendorId, companyMasterData } = ctx;

        let sizeMaster = await SizeMaster.findOne({ name: config.SIZE_MASTER_NAME, status: { $ne: 'D' } });

        if (sizeMaster && (sizeMaster.type !== 'LABEL' || !sizeMaster.values.includes(config.SIZE_LABEL_VALUE))) {
            throw new Error(`A SizeMaster named "${config.SIZE_MASTER_NAME}" already exists but is not a LABEL size with the value "${config.SIZE_LABEL_VALUE}". Change SIZE_MASTER_NAME in config.js or fix that record.`);
        }

        if (sizeMaster) {
            console.log(`\nSizeMaster "${config.SIZE_MASTER_NAME}" already exists (${sizeMaster._id}).`);
        } else if (args.apply) {
            sizeMaster = await SizeMaster.create({
                name: config.SIZE_MASTER_NAME,
                type: 'LABEL',
                values: [config.SIZE_LABEL_VALUE],
                status: 'A'
            });
            console.log(`\nSizeMaster "${config.SIZE_MASTER_NAME}" created (${sizeMaster._id}).`);
        } else {
            console.log(`\nSizeMaster "${config.SIZE_MASTER_NAME}" would be created.`);
        }

        const isAllowed = sizeMaster
            && (companyMasterData.allowedSizes || []).some(id => id.toString() === sizeMaster._id.toString());

        if (isAllowed) {
            console.log(`It is already allowed on the vendor's plan.`);
        } else if (args.apply) {
            await CompanyMaster.updateOne({ vendorId }, { $addToSet: { allowedSizes: sizeMaster._id } });
            await invalidateCache([redisKeys.companyMaster(vendorId), redisKeys.sizes(vendorId)]);
            console.log(`Added to the vendor's allowed sizes.`);
        } else {
            console.log(`It would be added to the vendor's allowed sizes.`);
        }
    } catch (err) {
        throw err;
    }
};

run(main);
