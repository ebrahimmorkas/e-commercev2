// migrations/resinArts/03-products.js
//
// Step 3 - products. Run 01-setup and 02-categories first.
//
// An old product was one flat record (price, stock, image on the product
// itself). A new product holds those on a size inside a variant, so every old
// product becomes: 1 product -> 1 default variant -> 1 default "Standard" size.
//
//   name, mainCategory, createdAt, updatedAt     copied as they are (the old _id is kept)
//   subCategory                                  copied; empty when it was the same as mainCategory
//   productDetails [{key,value}]                 -> description (blank entries dropped)
//   price / stock / image / additionalImages     -> the size's price / stock / image / additionalImages
//   bulkPricing [{quantity, wholesalePrice}]     -> see mapPricing below
//   isActive                                     -> status 'A' / 'I'
//   productCode, slug, variantCode, sizeCode, sku   generated (config.js)
//   discountPrice, discount dates, lastRestockedAt, categoryPath, deactivatedBy   dropped
//
// Skipped and listed in the report: a product with no price, products sharing
// one name, the old variant / dimension products, and anything else that fails
// the new product rules (middlewares/validations/productValidations.js).
//
//   node migrations/resinArts/03-products.js --vendor localhost --limit 20            (dry run)
//   node migrations/resinArts/03-products.js --vendor localhost --limit 20 --apply
//   node migrations/resinArts/03-products.js --vendor localhost --favorites --apply   (after 05-users, before 06-favorites)
//
// Safe to re-run: a product that is already there is left alone (--overwrite replaces it).

const Product = require('../../models/Product');
const User = require('../../models/User');
const Category = require('../../models/Category');
const ImageAsset = require('../../models/ImageAsset');
const SizeMaster = require('../../models/SizeMaster');
const slugify = require('../../utils/slugify');
const { createProductSchema } = require('../../middlewares/validations/productValidations');
const config = require('./config');
const { openContext, run } = require('./lib/runtime');
const { readCollection, selectRecords } = require('./lib/backupReader');
const { createReport } = require('./lib/report');
const { deterministicObjectId, buildImageAsset, saveDocument, describeValidationError } = require('./lib/helpers');

const SECTION = 'Products';

const normalizeName = (name) => {
    try {
        return String(name || '').trim().toLowerCase();
    } catch (err) {
        throw err;
    }
};

// Old pricing -> new pricing.
//
// In resinArts the tier for quantity 1 was the real selling price, and the
// product's own `price` was only shown struck through when it was higher
// (ProductDetailsPage.getEffectiveUnitPrice). So:
//   tier for quantity 1  -> the size's price
//   old product price    -> the size's cancelledPrice, when it is higher
//   remaining tiers      -> bulk pricing. An old tier meant "this quantity and
//                           above", so each one runs up to just below the next
//                           tier and the last one is closed with
//                           LAST_TIER_MAXIMUM_QUANTITY.
// A product with no quantity-1 tier simply keeps its own price.
//
// Returns { price, cancelledPrice, bulkPricing, note } or { skipReason }.
const mapPricing = (source) => {
    try {
        const tiers = (source.bulkPricing || []).map(tier => ({ quantity: tier.quantity, price: tier.wholesalePrice }));

        const hasInvalidTier = tiers.some(tier =>
            !Number.isInteger(tier.quantity) || tier.quantity < 1 || typeof tier.price !== 'number' || tier.price < 0
        );
        if (hasInvalidTier) {
            return { skipReason: 'a bulk pricing tier has a quantity that is not a whole number, or no price' };
        }
        const isAscending = tiers.every((tier, index) => index === 0 || tier.quantity > tiers[index - 1].quantity);
        if (!isAscending) {
            return { skipReason: 'the bulk pricing tiers are not in increasing quantity order' };
        }

        const hasSingleUnitTier = tiers.length > 0 && tiers[0].quantity === 1;
        const price = hasSingleUnitTier ? tiers[0].price : source.price;
        if (typeof price !== 'number') {
            return { skipReason: 'the product has no price' };
        }

        const cancelledPrice = typeof source.price === 'number' && source.price > price ? source.price : null;

        const remainingTiers = hasSingleUnitTier ? tiers.slice(1) : tiers;
        const ranges = [];
        for (let i = 0; i < remainingTiers.length; i++) {
            const tier = remainingTiers[i];
            const next = remainingTiers[i + 1];
            const maximumQuantity = next
                ? next.quantity - 1
                : Math.max(config.LAST_TIER_MAXIMUM_QUANTITY, tier.quantity + 1);

            if (maximumQuantity <= tier.quantity) {
                return { skipReason: `the bulk pricing tiers for quantity ${tier.quantity} and ${next.quantity} are one apart, which the new minimum-maximum tier cannot express` };
            }
            ranges.push({ minimumQuantity: tier.quantity, maximumQuantity, price: tier.price });
        }

        // A tier that is not cheaper than the selling price never applied in
        // the new cart (utils/bulkPricing.js) and the product rules reject it.
        const bulkPricing = ranges.filter(range => range.price < price);
        const droppedCount = ranges.length - bulkPricing.length;

        return {
            price,
            cancelledPrice,
            bulkPricing,
            note: droppedCount > 0 ? `${droppedCount} bulk pricing tier(s) left out because they were not cheaper than the selling price` : null
        };
    } catch (err) {
        throw err;
    }
};

// Old productDetails -> new description: entries missing a key or a value are
// dropped, and a repeated key keeps its first value (the new rules need both
// parts filled and every key distinct).
const mapDescription = (productDetails) => {
    try {
        const seenKeys = new Set();
        const description = [];

        for (const entry of (productDetails || [])) {
            const key = String(entry.key || '').trim();
            const value = String(entry.value || '').trim();
            if (!key || !value || seenKeys.has(key.toLowerCase())) continue;
            seenKeys.add(key.toLowerCase());
            description.push({ key, value });
        }

        return description;
    } catch (err) {
        throw err;
    }
};

// Checks the product against the same Joi schema the Add Product endpoint
// uses, in the shape that endpoint receives. Returns the failure messages
// joined into one string, or null when the product is valid.
const validateAgainstProductRules = ({ source, description, pricing, codes, mainCategory, subCategory, sizeMasterId, stock }) => {
    try {
        const { error } = createProductSchema.validate({
            name: source.name,
            description,
            colors: [config.DEFAULT_COLOR],
            mainCategory: mainCategory.toString(),
            subCategory: subCategory ? subCategory.toString() : null,
            productCode: codes.productCode,
            bulkPricing: pricing.bulkPricing,
            variants: [{
                isDefaultVariant: true,
                color: config.DEFAULT_COLOR,
                variantCode: codes.variantCode,
                sizes: [{
                    isDefaultSize: true,
                    sizeType: 'LABEL',
                    sizeName: config.SIZE_NAME,
                    sizeId: sizeMasterId.toString(),
                    labelValue: config.SIZE_LABEL_VALUE,
                    price: pricing.price,
                    cancelledPrice: pricing.cancelledPrice,
                    stock,
                    sku: codes.sku,
                    sizeCode: codes.sizeCode,
                    shipping: { type: 'COMPANY_SETTINGS' }
                }]
            }]
        }, { abortEarly: false });

        return error ? error.details.map(detail => detail.message).join('; ') : null;
    } catch (err) {
        throw err;
    }
};

// Builds the new product and the ImageAsset records its images need.
// Returns { product, imageAssets, note } or { skipReason }.
const buildProduct = (source, lookups, ctx) => {
    try {
        const { vendorId, adminId } = ctx;
        const { productNumbers, duplicateNames, categoriesById, takenSlugs, sizeMasterId } = lookups;

        if (duplicateNames.has(normalizeName(source.name))) {
            return { skipReason: 'another product in the old database has the same name - the new store allows a name only once' };
        }
        if ((source.variants || []).length > 0 || source.hasDimensions || (source.staticDimensions || []).length > 0 || (source.dimensions || []).length > 0) {
            return { skipReason: 'uses the old variant / dimension structure - needs to be re-created by hand' };
        }

        const pricing = mapPricing(source);
        if (pricing.skipReason) {
            return { skipReason: pricing.skipReason };
        }

        // --- categories ---------------------------------------------------------
        const mainCategory = source.mainCategory || null;
        if (!mainCategory || !categoriesById.has(mainCategory.toString())) {
            return { skipReason: `its main category ${mainCategory} is not in the new database (run 02-categories first)` };
        }
        const isSubSameAsMain = source.subCategory && source.subCategory.toString() === mainCategory.toString();
        const subCategory = source.subCategory && !isSubSameAsMain ? source.subCategory : null;
        if (subCategory) {
            const subCategoryDoc = categoriesById.get(subCategory.toString());
            if (!subCategoryDoc) {
                return { skipReason: `its sub category ${subCategory} is not in the new database (run 02-categories first)` };
            }
            if (String(subCategoryDoc.parent_category_id) !== mainCategory.toString()) {
                return { skipReason: `its sub category "${subCategoryDoc.categoryName}" does not belong to its main category` };
            }
        }

        // --- codes + slug ---------------------------------------------------------
        const number = String(productNumbers.get(source._id.toString())).padStart(config.CODE_PAD_LENGTH, '0');
        const productCode = `${config.CODE_PREFIX}-${number}`;
        const codes = {
            productCode,
            variantCode: `${productCode}-V1`,
            sizeCode: `${productCode}-V1-S1`,
            sku: `${productCode}-S1`
        };

        const baseSlug = slugify(source.name);
        const slugOwner = takenSlugs.get(baseSlug);
        const slug = slugOwner && slugOwner !== source._id.toString() ? `${baseSlug}-${number}` : baseSlug;

        const description = mapDescription(source.productDetails);
        const stock = Math.max(0, Math.floor(Number(source.stock) || 0));

        const ruleFailure = validateAgainstProductRules({ source, description, pricing, codes, mainCategory, subCategory, sizeMasterId, stock });
        if (ruleFailure) {
            return { skipReason: `fails the new product rules: ${ruleFailure}` };
        }

        // --- images -----------------------------------------------------------------
        const createdAt = source.createdAt || source._id.getTimestamp();
        const updatedAt = source.updatedAt || createdAt;
        const imageAssets = [];
        const unreadableImages = [];

        const toImage = (url, slot) => {
            try {
                const asset = buildImageAsset({ vendorId, module: 'productSize', url, ownerId: source._id, slot, adminId, createdAt });
                if (!asset) {
                    unreadableImages.push(url);
                    return null;
                }
                imageAssets.push(asset);
                return { url: asset.url, imageAssetId: asset._id };
            } catch (err) {
                throw err;
            }
        };

        const mainImage = source.image ? toImage(source.image, 'image') : null;
        const additionalImages = (source.additionalImages || [])
            .map((url, index) => toImage(url, `additional-${index}`))
            .filter(Boolean);

        // --- document -----------------------------------------------------------------
        const isInactive = source.isActive === false;
        const audit = { status: 'A', createdBy: adminId, remarks: config.REMARKS };

        const product = new Product({
            _id: source._id,
            vendorId,
            name: source.name,
            description,
            colors: [config.DEFAULT_COLOR],
            mainCategory,
            subCategory,
            slug,
            productCode: codes.productCode,
            bulkPricing: pricing.bulkPricing,
            variants: [{
                _id: deterministicObjectId('variant', source._id),
                isDefaultVariant: true,
                color: config.DEFAULT_COLOR,
                variantCode: codes.variantCode,
                sizes: [{
                    _id: deterministicObjectId('size', source._id),
                    isDefaultSize: true,
                    sizeType: 'LABEL',
                    sizeName: config.SIZE_NAME,
                    sizeId: sizeMasterId,
                    labelValue: config.SIZE_LABEL_VALUE,
                    image: mainImage || { url: null, imageAssetId: null },
                    additionalImages,
                    price: pricing.price,
                    cancelledPrice: pricing.cancelledPrice,
                    stock,
                    sku: codes.sku,
                    sizeCode: codes.sizeCode,
                    shipping: { type: 'COMPANY_SETTINGS', value: null },
                    ...audit
                }],
                ...audit
            }],
            ...audit,
            status: isInactive ? 'I' : 'A',
            inActiveMarkedBy: isInactive ? adminId : undefined,
            inactiveMarkedDate: isInactive ? updatedAt : null,
            createdAt,
            updatedAt
        });

        const notes = [pricing.note];
        if (unreadableImages.length > 0) {
            notes.push(`${unreadableImages.length} image URL(s) are not Cloudinary images and were left out`);
        }

        return { product, imageAssets, slug, note: notes.filter(Boolean).join('; ') || null };
    } catch (err) {
        throw err;
    }
};

// Everything buildProduct needs to look up, loaded once for the whole run.
const loadLookups = async (allProducts, ctx) => {
    try {
        const { vendorId, companyMasterData } = ctx;

        const sizeMaster = await SizeMaster.findOne({ name: config.SIZE_MASTER_NAME, type: 'LABEL', status: 'A' }).lean();
        const isSizeAllowed = sizeMaster
            && (companyMasterData.allowedSizes || []).some(id => id.toString() === sizeMaster._id.toString());
        if (!isSizeAllowed) {
            throw new Error(`The "${config.SIZE_MASTER_NAME}" size is missing or not allowed on this vendor's plan. Run 01-setup.js --apply first.`);
        }

        // Position in the whole backup (oldest first), so a product gets the
        // same code whether it is migrated in the pilot or in the full run.
        const productNumbers = new Map(allProducts.map((product, index) => [product._id.toString(), index + 1]));

        const nameCounts = new Map();
        for (const product of allProducts) {
            const key = normalizeName(product.name);
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        }
        const duplicateNames = new Set([...nameCounts].filter(([, count]) => count > 1).map(([key]) => key));

        const categories = await Category.find({ vendorId, status: { $ne: 'D' } }).select('categoryName parent_category_id').lean();
        const categoriesById = new Map(categories.map(category => [category._id.toString(), category]));

        const liveProducts = await Product.find({ vendorId, status: { $ne: 'D' } }).select('name slug').lean();
        const takenSlugs = new Map(liveProducts.map(product => [product.slug, product._id.toString()]));
        const takenNames = new Map(liveProducts.map(product => [normalizeName(product.name), product._id.toString()]));

        return { productNumbers, duplicateNames, categoriesById, takenSlugs, takenNames, sizeMasterId: sizeMaster._id };
    } catch (err) {
        throw err;
    }
};

// --favorites: the old ids of every product that a customer who is already in
// the new database had as a favourite.
const findFavoriteProductIds = async (backupDir, vendorId) => {
    try {
        const withFavorites = readCollection(backupDir, 'users').filter(user => (user.favorites || []).length > 0);
        const migrated = await User.find({ vendorId, _id: { $in: withFavorites.map(user => user._id) }, role: 'user', status: { $ne: 'D' } }).select('_id').lean();
        const migratedIds = new Set(migrated.map(user => user._id.toString()));

        return [...new Set(
            withFavorites
                .filter(user => migratedIds.has(user._id.toString()))
                .flatMap(user => user.favorites.map(id => id.toString()))
        )];
    } catch (err) {
        throw err;
    }
};

const main = async () => {
    try {
        const ctx = await openContext('03-products');
        const { args, vendorId } = ctx;
        const report = createReport('03-products', args.apply);
        const saveOptions = { apply: args.apply, overwrite: args.overwrite, vendorId };

        await Product.init();

        const all = readCollection(args.backupDir, 'products');
        const ids = args.favorites ? [...args.ids, ...(await findFavoriteProductIds(args.backupDir, vendorId))] : args.ids;
        // --favorites that finds nothing must select nothing - not fall through
        // to "no filter", which means the whole collection.
        const isEmptyFavoritesRun = args.favorites && args.limit === null && ids.length === 0;
        const selected = isEmptyFavoritesRun ? [] : selectRecords(all, { limit: args.limit, ids });
        const lookups = await loadLookups(all, ctx);

        for (const source of selected) {
            const label = `${source.name} (${source._id})`;

            // A dry run cannot hit the unique index, so check the name here.
            const nameOwner = lookups.takenNames.get(normalizeName(source.name));
            if (nameOwner && nameOwner !== source._id.toString()) {
                report.add(SECTION, 'duplicate', label, 'the new store already has a product with this name');
                continue;
            }

            try {
                const built = buildProduct(source, lookups, ctx);
                if (built.skipReason) {
                    report.add(SECTION, 'skipped', label, built.skipReason);
                    continue;
                }

                // Image records first, the same order the app uses - and any
                // this run created are removed again if the product is not written.
                const insertedAssetIds = [];
                for (const imageAsset of built.imageAssets) {
                    const assetResult = await saveDocument(ImageAsset, imageAsset, saveOptions);
                    if (assetResult.outcome === 'inserted') insertedAssetIds.push(imageAsset._id);
                }

                const result = await saveDocument(Product, built.product, saveOptions);

                if (result.outcome === 'duplicate' || result.outcome === 'conflict') {
                    if (insertedAssetIds.length > 0) {
                        await ImageAsset.deleteMany({ _id: { $in: insertedAssetIds } });
                    }
                } else {
                    lookups.takenSlugs.set(built.slug, source._id.toString());
                    lookups.takenNames.set(normalizeName(source.name), source._id.toString());
                }

                report.add(SECTION, result.outcome, label, result.reason || built.note);
            } catch (err) {
                const validationMessage = describeValidationError(err);
                if (!validationMessage) throw err;
                report.add(SECTION, 'skipped', label, `fails the new product model: ${validationMessage}`);
            }
        }

        report.print();
        report.save();
    } catch (err) {
        throw err;
    }
};

run(main);
