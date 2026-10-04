// migrations/resinArts/02-categories.js
//
// Step 2 - categories. Old -> new:
//   _id, categoryName, parent_category_id, createdAt, updatedAt   copied as they are
//   image (a bare URL)   -> image { url, imageAssetId } + an ImageAsset record
//   isActive             -> status 'A' / 'I'
//   deactivatedProducts  -> dropped (the new app has no such list)
//
// The old _id is kept, so products (step 3) keep pointing at their categories.
// A sub category is only migrated once its parent is in the new database.
//
//   node migrations/resinArts/02-categories.js --vendor localhost            (dry run)
//   node migrations/resinArts/02-categories.js --vendor localhost --apply
//
// Safe to re-run: a category that is already there is left alone (--overwrite replaces it).

const Category = require('../../models/Category');
const ImageAsset = require('../../models/ImageAsset');
const redisKeys = require('../../utils/redisKeys');
const { openContext, invalidateCache, run } = require('./lib/runtime');
const { readCollection, selectRecords } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { buildImageAsset, saveDocument, describeValidationError } = require('./lib/helpers');

const SECTION = 'Categories';

const buildCategory = (source, ctx) => {
    try {
        const { vendorId, adminId } = ctx;
        const isInactive = source.isActive === false;
        const createdAt = source.createdAt || source._id.getTimestamp();
        const updatedAt = source.updatedAt || createdAt;

        const imageAsset = source.image
            ? buildImageAsset({ vendorId, module: 'category', url: source.image, ownerId: source._id, slot: 'image', adminId, createdAt })
            : null;

        const category = new Category({
            _id: source._id,
            vendorId,
            categoryName: source.categoryName,
            parent_category_id: source.parent_category_id || null,
            image: {
                url: imageAsset ? imageAsset.url : null,
                imageAssetId: imageAsset ? imageAsset._id : null
            },
            status: isInactive ? 'I' : 'A',
            createdBy: adminId,
            inActiveMarkedBy: isInactive ? adminId : null,
            inactiveMarkedDate: isInactive ? updatedAt : null,
            createdAt,
            updatedAt
        });

        return { category, imageAsset, hasUnreadableImage: !!source.image && !imageAsset };
    } catch (err) {
        throw err;
    }
};

const main = async () => {
    try {
        const ctx = await openContext('02-categories');
        const { args, vendorId } = ctx;
        const report = createReport('02-categories', args.apply);
        const saveOptions = { apply: args.apply, overwrite: args.overwrite, vendorId };

        await Category.init();

        const all = readCollection(args.backupDir, 'categories');
        const selected = selectRecords(all, args);

        // Parents before children, so a child's parent check below can pass
        // within the same run.
        selected.sort((a, b) => (a.parent_category_id ? 1 : 0) - (b.parent_category_id ? 1 : 0));

        // Ids of the categories that are (or, in a dry run, would be) in the new database.
        const existing = await Category.find({ vendorId, status: { $ne: 'D' } }).select('_id').lean();
        const availableIds = new Set(existing.map(c => c._id.toString()));

        for (const source of selected) {
            const label = `${source.categoryName} (${source._id})`;

            if (source.parent_category_id && !availableIds.has(source.parent_category_id.toString())) {
                report.add(SECTION, 'skipped', label, `its parent category ${source.parent_category_id} is not in the new database`);
                continue;
            }

            try {
                const { category, imageAsset, hasUnreadableImage } = buildCategory(source, ctx);

                const assetResult = imageAsset ? await saveDocument(ImageAsset, imageAsset, saveOptions) : null;
                const result = await saveDocument(Category, category, saveOptions);

                if (result.outcome === 'duplicate' || result.outcome === 'conflict') {
                    // The category was not written, so an ImageAsset this run
                    // just created for it would be left pointing at nothing.
                    if (assetResult && assetResult.outcome === 'inserted') {
                        await ImageAsset.deleteOne({ _id: imageAsset._id });
                    }
                } else {
                    availableIds.add(source._id.toString());
                }

                report.add(SECTION, result.outcome, label, result.reason || (hasUnreadableImage ? `image URL is not a Cloudinary image and was left out: ${source.image}` : null));
            } catch (err) {
                const validationMessage = describeValidationError(err);
                if (!validationMessage) throw err;
                report.add(SECTION, 'skipped', label, `fails the new category rules: ${validationMessage}`);
            }
        }

        if (args.apply) {
            await invalidateCache([redisKeys.category(vendorId), redisKeys.categoryAdmin(vendorId)]);
        }

        report.print();
        report.save();
    } catch (err) {
        throw err;
    }
};

run(main);
