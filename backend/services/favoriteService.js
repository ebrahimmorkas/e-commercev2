const Product = require('../models/Product');
const Favorite = require('../models/Favorite');
const cartService = require('./cartService');
const orderService = require('./orderService');
const common = require('../utils/common');

// Resolves the live Product/Variant/Size docs for a requested favorite,
// enforcing: product/variant/size must all exist and be status 'A'. Mirrors
// resolveActiveProductLine in cartService.js.
const resolveActiveProductLine = async (vendorId, productId, variantId, sizeId) => {
    try {
        const product = await Product.findOne({ _id: productId, vendorId, status: 'A' });
        if (!product) return { error: 'Product not found or is not currently available.' };

        const variant = product.variants.id(variantId);
        if (!variant || variant.status !== 'A') {
            return { error: 'Selected variant is not currently available.' };
        }

        const size = variant.sizes.id(sizeId);
        if (!size || size.status !== 'A') {
            return { error: 'Selected size is not currently available.' };
        }

        return { product, variant, size };
    } catch (err) {
        throw err;
    }
};

const buildFavoriteResponse = (favorite, product, variant, size) => {
    return {
        favoriteId: favorite._id,
        productId: product._id,
        productName: product.name,
        variantId: variant._id,
        variantName: variant.displayName || variant.color || 'Default',
        sizeId: size._id,
        sizeName: size.sizeName,
        labelValue: size.labelValue || null,
        price: size.price,
        cancelledPrice: size.cancelledPrice,
        stock: size.stock,
        sku: size.sku,
        image: size.image?.url || null,
        addedAt: favorite.createdAt
    };
};

const addToFavorites = async (vendorId, userId, websiteMasterData, companyMasterData, productId, variantId, sizeId) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId,
            websiteMasterData,
            companyMasterData,
            'isFavoritesFeatureOn',
            'isFavoritesFeatureOn'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const resolved = await resolveActiveProductLine(vendorId, productId, variantId, sizeId);
        if (resolved.error) {
            return common.returnResult(false, 404, resolved.error);
        }
        const { product, variant, size } = resolved;

        // Includes soft-deleted entries on purpose, so a previously removed
        // favorite can be reactivated instead of hitting the partial unique
        // index with a duplicate insert.
        const existing = await Favorite.findOne({ vendorId, userId, productId, variantId, sizeId });

        if (existing && existing.status === 'A') {
            return common.returnResult(false, 409, 'This size is already in your favorites');
        }

        if (existing && existing.status !== 'A') {
            existing.status = 'A';
            existing.activeMarkedBy = userId;
            existing.activeMarkedDate = new Date();
            existing.updatedBy = userId;
            await existing.save();

            return common.returnResult(true, 200, 'Added to favorites', {
                favorite: buildFavoriteResponse(existing, product, variant, size)
            });
        }

        const cap = companyMasterData.numberOfItemsAllowedInFavorites;
        if (cap === 0) {
            return common.returnResult(false, 403, 'Favorites are not allowed for your account');
        }
        if (cap) {
            const currentCount = await Favorite.countDocuments({ vendorId, userId, status: 'A' });
            if (currentCount >= cap) {
                return common.returnResult(false, 403, `You can only have ${cap} item(s) in your favorites`);
            }
        }

        const favorite = await Favorite.create({
            vendorId,
            userId,
            productId,
            variantId,
            sizeId,
            createdBy: userId
        });

        return common.returnResult(true, 201, 'Added to favorites', {
            favorite: buildFavoriteResponse(favorite, product, variant, size)
        });
    } catch (err) {
        throw err;
    }
};

const removeFromFavorites = async (vendorId, userId, productId, variantId, sizeId) => {
    try {
        const favorite = await Favorite.findOne({ vendorId, userId, productId, variantId, sizeId, status: 'A' });
        if (!favorite) {
            return common.returnResult(false, 404, 'Favorite not found');
        }

        favorite.status = 'D';
        favorite.deletedBy = userId;
        await favorite.save();

        return common.returnResult(true, 200, 'Removed from favorites');
    } catch (err) {
        throw err;
    }
};

const getFavorites = async (vendorId, userId, page = 1, limit = 20) => {
    try {
        const total = await Favorite.countDocuments({ vendorId, userId, status: 'A' });

        const favorites = await Favorite.find({ vendorId, userId, status: 'A' })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const productIds = [...new Set(favorites.map((favorite) => favorite.productId.toString()))];
        const products = await Product.find({ _id: { $in: productIds }, vendorId });
        const productMap = new Map(products.map((product) => [product._id.toString(), product]));

        // A favorite whose product/variant/size no longer resolves (deleted,
        // or the product removed) is silently dropped from the list rather
        // than surfaced as an error - the favorite row itself is left intact
        // in case the product comes back.
        const items = [];
        for (const favorite of favorites) {
            const product = productMap.get(favorite.productId.toString());
            if (!product) continue;

            const variant = product.variants.id(favorite.variantId);
            if (!variant) continue;

            const size = variant.sizes.id(favorite.sizeId);
            if (!size) continue;

            items.push(buildFavoriteResponse(favorite, product, variant, size));
        }

        return common.returnResult(true, 200, 'Favorites fetched successfully', {
            favorites: items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        throw err;
    }
};

// Places an order built from one or more favorited sizes. Each selected
// favorite (with its own requested quantity) is pushed into the user's
// active cart via cartService.addProductToCart - the SAME function the
// normal add-to-cart endpoint uses, so stock/location/feature/cart-cap
// checks all apply identically - and orderService.createOrderFromCart then
// takes over for pricing/tax/order-number/order-step assignment exactly as
// it does for a regular checkout. Favorites themselves are left untouched
// (an order does not remove the item from the user's favorites list).
const createOrderFromFavorites = async (
    vendorId,
    userId,
    userCountryId,
    locationContext,
    companyMasterData,
    websiteMasterData,
    companySettingsData,
    shippingPriceSettingsData,
    items,
    orderPayload
) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId,
            websiteMasterData,
            companyMasterData,
            'isFavoritesFeatureOn',
            'isFavoritesFeatureOn'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const favoriteIds = items.map((item) => item.favoriteId);
        const favorites = await Favorite.find({ _id: { $in: favoriteIds }, vendorId, userId, status: 'A' });
        const favoriteMap = new Map(favorites.map((favorite) => [favorite._id.toString(), favorite]));

        const missingIds = favoriteIds.filter((id) => !favoriteMap.has(id.toString()));
        if (missingIds.length > 0) {
            return common.returnResult(false, 404, 'One or more selected favorite items were not found');
        }

        const cartOwner = { type: 'user', id: userId };

        for (const item of items) {
            const favorite = favoriteMap.get(item.favoriteId.toString());

            const addResult = await cartService.addProductToCart(
                vendorId,
                cartOwner,
                locationContext,
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                {
                    productId: favorite.productId,
                    variantId: favorite.variantId,
                    sizeId: favorite.sizeId,
                    quantity: item.quantity
                }
            );

            if (!addResult.isSuccess) {
                return common.returnResult(false, addResult.statusCode, addResult.message);
            }
        }

        return await orderService.createOrderFromCart(
            vendorId,
            userId,
            userCountryId,
            companyMasterData,
            websiteMasterData,
            companySettingsData,
            shippingPriceSettingsData,
            orderPayload
        );
    } catch (err) {
        throw err;
    }
};

module.exports = {
    addToFavorites,
    removeFromFavorites,
    getFavorites,
    createOrderFromFavorites
};
