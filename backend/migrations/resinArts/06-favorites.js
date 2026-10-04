// migrations/resinArts/06-favorites.js
//
// Step 6 - favourites. Run after 03-products and 05-users.
//
// The old store kept a list of product ids on the customer. The new store
// keeps one Favorite record per customer per SIZE of a product - and since
// every migrated product has exactly one variant with one size, an old
// favourite points at that size.
//
// Only customers that are already in the new database are looked at, so this
// follows whatever 05-users migrated (--limit / --ids are not needed here).
// A favourite whose product has not been migrated yet is listed in the
// report; re-run this script once that product is in.
//
//   node migrations/resinArts/06-favorites.js --vendor localhost            (dry run)
//   node migrations/resinArts/06-favorites.js --vendor localhost --apply
//
// Safe to re-run: a favourite that is already there is left alone.

const User = require('../../models/User');
const Product = require('../../models/Product');
const Favorite = require('../../models/Favorite');
const { openContext, run } = require('./lib/runtime');
const { readCollection } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { deterministicObjectId, saveDocument, describeValidationError } = require('./lib/helpers');

const SECTION = 'Favorites';

const main = async () => {
    try {
        const ctx = await openContext('06-favorites');
        const { args, vendorId } = ctx;
        const report = createReport('06-favorites', args.apply);
        const saveOptions = { apply: args.apply, overwrite: args.overwrite, vendorId };

        await Favorite.init();

        const migratedAt = new Date();

        const withFavorites = readCollection(args.backupDir, 'users').filter(user => (user.favorites || []).length > 0);

        const migratedUsers = await User.find({ vendorId, _id: { $in: withFavorites.map(user => user._id) }, role: 'user', status: { $ne: 'D' } }).select('email').lean();
        const migratedUsersById = new Map(migratedUsers.map(user => [user._id.toString(), user]));

        const productIds = withFavorites.flatMap(user => user.favorites);
        const products = await Product.find({ vendorId, _id: { $in: productIds }, status: { $ne: 'D' } }).select('name variants._id variants.sizes._id').lean();
        const productsById = new Map(products.map(product => [product._id.toString(), product]));

        console.log(`\n${withFavorites.length} old customer(s) have favourites; ${migratedUsers.length} of them are in the new database.`);

        for (const source of withFavorites) {
            const user = migratedUsersById.get(source._id.toString());
            if (!user) continue;

            // The same product listed twice in the old array is one favourite.
            const favoriteProductIds = [...new Set(source.favorites.map(id => id.toString()))];

            for (const productId of favoriteProductIds) {
                const product = productsById.get(productId);
                if (!product) {
                    report.add(SECTION, 'skipped', `${user.email} -> product ${productId}`, 'the product is not in the new database (not migrated yet, or skipped by 03-products)');
                    continue;
                }

                const label = `${user.email} -> ${product.name}`;
                const variant = product.variants[0];
                const size = variant && variant.sizes[0];
                if (!size) {
                    report.add(SECTION, 'skipped', label, 'the product has no size to point the favourite at');
                    continue;
                }

                try {
                    const favorite = new Favorite({
                        _id: deterministicObjectId('favorite', source._id, productId),
                        vendorId,
                        userId: source._id,
                        productId: product._id,
                        variantId: variant._id,
                        sizeId: size._id,
                        status: 'A',
                        createdBy: source._id,
                        // The old list recorded no date, and saveDocument
                        // writes with timestamps off - so set them here.
                        createdAt: migratedAt,
                        updatedAt: migratedAt
                    });

                    const result = await saveDocument(Favorite, favorite, saveOptions);
                    report.add(SECTION, result.outcome, label, result.reason);
                } catch (err) {
                    const validationMessage = describeValidationError(err);
                    if (!validationMessage) throw err;
                    report.add(SECTION, 'skipped', label, `fails the new favourite model: ${validationMessage}`);
                }
            }
        }

        report.print();
        report.save();
    } catch (err) {
        throw err;
    }
};

run(main);
