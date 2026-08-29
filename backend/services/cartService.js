const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const TaxMaster = require('../models/TaxMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| SHARED HELPERS
|--------------------------------------------------------------------------
*/

// Normalizes req.cartOwner -> the Mongo filter fragment identifying the
// cart, and a redis-cache-safe owner key.
const ownerFilter = (cartOwner) => {
    return cartOwner.type === 'user'
        ? { userId: cartOwner.id }
        : { guestId: cartOwner.id };
};

const ownerCacheKey = (cartOwner) => `${cartOwner.type}:${cartOwner.id}`;

const invalidateCartTotalCache = async (vendorId, cartOwner) => {
    await redisService.del(redisKeys.cartTotal(vendorId, ownerCacheKey(cartOwner)));
};

// A size is excluded for a location if ANY of the location's known IDs
// (country/state/city) or zip code appear in that size's exclude arrays.
// Any/all of the location fields may be null (cookie not set, or guest with
// no location info at all) - a null field simply never matches, which is
// the "unknown location -> allow" behavior you asked for.
const isSizeExcludedForLocation = (size, locationContext = {}) => {
    const { countryId, stateId, cityId, zipCode } = locationContext;

    if (countryId && (size.excludeCountries || []).some((id) => id.toString() === countryId.toString())) {
        return { excluded: true, scope: 'country' };
    }
    if (stateId && (size.excludeStates || []).some((id) => id.toString() === stateId.toString())) {
        return { excluded: true, scope: 'state' };
    }
    if (cityId && (size.excludeCities || []).some((id) => id.toString() === cityId.toString())) {
        return { excluded: true, scope: 'city' };
    }
    if (zipCode && (size.excludeZipCodes || []).some((z) => z === zipCode)) {
        return { excluded: true, scope: 'zip code' };
    }
    return { excluded: false };
};

const findOrCreateActiveCart = async (vendorId, cartOwner) => {
    const filter = { vendorId, status: 'A', ...ownerFilter(cartOwner) };
    let cart = await Cart.findOne(filter);
    if (!cart) {
        cart = await Cart.create({
            vendorId,
            ...ownerFilter(cartOwner),
            products: []
        });
    }
    return cart;
};

// Locates a specific size line item inside a cart's products array.
// Returns { productEntry, variantEntry, sizeEntry } or nulls if not found.
const locateCartLineItem = (cart, productId, variantId, sizeId) => {
    const productEntry = cart.products.find((p) => p.productId.toString() === productId.toString());
    if (!productEntry) return { productEntry: null, variantEntry: null, sizeEntry: null };

    const variantEntry = productEntry.variants.find((v) => v.variantId.toString() === variantId.toString());
    if (!variantEntry) return { productEntry, variantEntry: null, sizeEntry: null };

    const sizeEntry = variantEntry.sizes.find((s) => s.sizeId.toString() === sizeId.toString());
    return { productEntry, variantEntry, sizeEntry: sizeEntry || null };
};

const countDistinctLineItems = (products) => {
    return products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.sizes.length, 0), 0);
};

// Resolves the live Product/Variant/Size docs for a requested add-to-cart,
// enforcing: product/variant/size must all exist and be status 'A'.
const resolveActiveProductLine = async (vendorId, productId, variantId, sizeId) => {
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
};

/*
|--------------------------------------------------------------------------
| ADD / UPDATE / REMOVE
|--------------------------------------------------------------------------
*/

const addProductToCart = async (vendorId, cartOwner, locationContext, companyMasterData, websiteMasterData, companySettingsData, payload) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isCartFeatureOn', 'isCartFeatureOn');
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { productId, variantId, sizeId, quantity } = payload;

        const resolved = await resolveActiveProductLine(vendorId, productId, variantId, sizeId);
        if (resolved.error) {
            return common.returnResult(false, 404, resolved.error);
        }
        const { product, variant, size } = resolved;

        const exclusionCheck = isSizeExcludedForLocation(size, locationContext);
        if (exclusionCheck.excluded) {
            const locationNames = await common.resolveLocationNames(locationContext);
            const place = locationNames.cityName || locationNames.stateName || locationNames.countryName || 'your location';
            return common.returnResult(false, 403, `This product is not available for delivery in ${place}.`);
        }

        const cart = await findOrCreateActiveCart(vendorId, cartOwner);

        const { sizeEntry: existingSizeEntry } = locateCartLineItem(cart, productId, variantId, sizeId);
        const requestedTotalQty = (existingSizeEntry ? existingSizeEntry.quantity : 0) + quantity;

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        if (!allowOutOfStock && size.stock < requestedTotalQty) {
            return common.returnResult(false, 400, `Only ${size.stock} unit(s) of this size are in stock.`);
        }

        if (existingSizeEntry) {
            existingSizeEntry.quantity = requestedTotalQty;
        } else {
            const currentLineItemCount = countDistinctLineItems(cart.products);
            const limit = companyMasterData?.numberOfProductsAllowedInCartAtOnce ?? 50;
            if (currentLineItemCount + 1 > limit) {
                return common.returnResult(false, 400, `You can only have ${limit} distinct items in your cart at once. Please remove an item before adding a new one.`);
            }

            const sizeLine = {
                sizeId: size._id,
                sizeName: size.sizeName,
                unitPrice: size.price,
                sku: size.sku,
                quantity
            };

            let productEntry = cart.products.find((p) => p.productId.toString() === productId.toString());
            if (!productEntry) {
                cart.products.push({
                    productId: product._id,
                    productName: product.name,
                    variants: [{
                        variantId: variant._id,
                        variantName: variant.displayName || variant.color || 'Default',
                        sizes: [sizeLine]
                    }]
                });
            } else {
                let variantEntry = productEntry.variants.find((v) => v.variantId.toString() === variantId.toString());
                if (!variantEntry) {
                    productEntry.variants.push({
                        variantId: variant._id,
                        variantName: variant.displayName || variant.color || 'Default',
                        sizes: [sizeLine]
                    });
                } else {
                    variantEntry.sizes.push(sizeLine);
                }
            }
        }

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Product added to cart successfully', { cart });
    } catch (err) {
        throw err;
    }
};

const updateCartItemQuantity = async (vendorId, cartOwner, companySettingsData, payload) => {
    try {
        const { productId, variantId, sizeId, quantity } = payload;

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(false, 404, 'Cart not found.');
        }

        const { productEntry, variantEntry, sizeEntry } = locateCartLineItem(cart, productId, variantId, sizeId);
        if (!sizeEntry) {
            return common.returnResult(false, 404, 'This item is not present in your cart.');
        }

        if (quantity <= 0) {
            return removeCartItem(vendorId, cartOwner, { productId, variantId, sizeId });
        }

        const resolved = await resolveActiveProductLine(vendorId, productId, variantId, sizeId);
        if (resolved.error) {
            return common.returnResult(false, 404, resolved.error);
        }

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        if (!allowOutOfStock && resolved.size.stock < quantity) {
            return common.returnResult(false, 400, `Only ${resolved.size.stock} unit(s) of this size are in stock.`);
        }

        sizeEntry.quantity = quantity;
        // Snapshot price may have moved since it was first added - refresh it.
        sizeEntry.unitPrice = resolved.size.price;

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Cart item quantity updated successfully', { cart });
    } catch (err) {
        throw err;
    }
};

const removeCartItem = async (vendorId, cartOwner, payload) => {
    try {
        const { productId, variantId, sizeId } = payload;

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(false, 404, 'Cart not found.');
        }

        const productEntry = cart.products.find((p) => p.productId.toString() === productId.toString());
        if (!productEntry) {
            return common.returnResult(false, 404, 'This item is not present in your cart.');
        }

        const variantEntry = productEntry.variants.find((v) => v.variantId.toString() === variantId.toString());
        if (!variantEntry) {
            return common.returnResult(false, 404, 'This item is not present in your cart.');
        }

        variantEntry.sizes = variantEntry.sizes.filter((s) => s.sizeId.toString() !== sizeId.toString());

        if (variantEntry.sizes.length === 0) {
            productEntry.variants = productEntry.variants.filter((v) => v.variantId.toString() !== variantId.toString());
        }
        if (productEntry.variants.length === 0) {
            cart.products = cart.products.filter((p) => p.productId.toString() !== productId.toString());
        }

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Item removed from cart successfully', { cart });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| FETCH CART (re-validates + computes cached total)
|--------------------------------------------------------------------------
*/

const dropCartLineItem = (cart, { productEntry, variantEntry, sizeEntry }, reason, reasonText) => {
    cart.removedItems.push({
        productId: productEntry.productId,
        productName: productEntry.productName,
        variantId: variantEntry.variantId,
        variantName: variantEntry.variantName,
        sizeId: sizeEntry.sizeId,
        sizeName: sizeEntry.sizeName,
        reason,
        reasonText
    });
    variantEntry.sizes = variantEntry.sizes.filter((s) => s.sizeId.toString() !== sizeEntry.sizeId.toString());
};

const pruneEmptyProducts = (cart) => {
    cart.products.forEach((p) => {
        p.variants = p.variants.filter((v) => v.sizes.length > 0);
    });
    cart.products = cart.products.filter((p) => p.variants.length > 0);
};

// Re-validates every line item against current Product data (status +
// location exclusion) and silently drops anything no longer valid, logging
// why into cart.removedItems. Returns true if the cart was mutated.
const revalidateCartItems = async (cart, locationContext) => {
    if (cart.products.length === 0) return false;

    const productIds = cart.products.map((p) => p.productId);
    const liveProducts = await Product.find({ _id: { $in: productIds } });
    const liveProductMap = new Map(liveProducts.map((p) => [p._id.toString(), p]));

    let mutated = false;

    for (const productEntry of [...cart.products]) {
        const liveProduct = liveProductMap.get(productEntry.productId.toString());

        if (!liveProduct || liveProduct.status !== 'A') {
            for (const variantEntry of [...productEntry.variants]) {
                for (const sizeEntry of [...variantEntry.sizes]) {
                    dropCartLineItem(cart, { productEntry, variantEntry, sizeEntry }, 'INACTIVE_STATUS',
                        `Removed because "${productEntry.productName}" is no longer available.`);
                    mutated = true;
                }
            }
            continue;
        }

        for (const variantEntry of [...productEntry.variants]) {
            const liveVariant = liveProduct.variants.id(variantEntry.variantId);

            if (!liveVariant || liveVariant.status !== 'A') {
                for (const sizeEntry of [...variantEntry.sizes]) {
                    dropCartLineItem(cart, { productEntry, variantEntry, sizeEntry }, 'INACTIVE_STATUS',
                        `Removed because the "${variantEntry.variantName}" option of "${productEntry.productName}" is no longer available.`);
                    mutated = true;
                }
                continue;
            }

            for (const sizeEntry of [...variantEntry.sizes]) {
                const liveSize = liveVariant.sizes.id(sizeEntry.sizeId);

                if (!liveSize || liveSize.status !== 'A') {
                    dropCartLineItem(cart, { productEntry, variantEntry, sizeEntry }, 'INACTIVE_STATUS',
                        `Removed because size "${sizeEntry.sizeName}" of "${productEntry.productName}" is no longer available.`);
                    mutated = true;
                    continue;
                }

                const exclusionCheck = isSizeExcludedForLocation(liveSize, locationContext);
                if (exclusionCheck.excluded) {
                    dropCartLineItem(cart, { productEntry, variantEntry, sizeEntry }, 'EXCLUDED_LOCATION',
                        `Removed because "${productEntry.productName}" (${sizeEntry.sizeName}) is not available for delivery to your location.`);
                    mutated = true;
                } else {
                    // Keep price/name fresh even when nothing was dropped.
                    sizeEntry.unitPrice = liveSize.price;
                    sizeEntry.sizeName = liveSize.sizeName;
                }
            }
        }
    }

    if (mutated) {
        pruneEmptyProducts(cart);
    }

    return mutated;
};

const computeCartSubtotal = (cart) => {
    let subtotal = 0;
    let totalQuantity = 0;
    for (const p of cart.products) {
        for (const v of p.variants) {
            for (const s of v.sizes) {
                subtotal += s.unitPrice * s.quantity;
                totalQuantity += s.quantity;
            }
        }
    }
    return { subtotal, totalQuantity };
};

const getCart = async (vendorId, cartOwner, locationContext) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(true, 200, 'Cart is empty', {
                cart: null,
                subtotal: 0,
                totalQuantity: 0
            });
        }

        const mutated = await revalidateCartItems(cart, locationContext);
        if (mutated) {
            await cart.save();
            await invalidateCartTotalCache(vendorId, cartOwner);
        }

        // Cache the computed subtotal (point 4) so repeated cart-opens
        // between mutations don't re-walk the products array server-side
        // and don't need a round trip beyond a cheap Redis GET. Any
        // mutation (add/update/remove/merge) calls invalidateCartTotalCache
        // so this can never go stale.
        const cacheKey = redisKeys.cartTotal(vendorId, ownerCacheKey(cartOwner));
        const totals = await redisService.getOrSet(cacheKey, async () => computeCartSubtotal(cart), 3600);

        return common.returnResult(true, 200, 'Cart fetched successfully', {
            cart,
            subtotal: totals.subtotal,
            totalQuantity: totals.totalQuantity
        });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| GUEST -> USER MERGE (on login)
|--------------------------------------------------------------------------
*/

const mergeGuestCartIntoUserCart = async (vendorId, userId, guestCartId, locationContext, companyMasterData) => {
    try {
        if (!guestCartId) {
            return common.returnResult(true, 200, 'No guest cart to merge');
        }

        const guestCart = await Cart.findOne({ vendorId, guestId: guestCartId, status: 'A' });
        if (!guestCart || guestCart.products.length === 0) {
            if (guestCart) await Cart.deleteOne({ _id: guestCart._id });
            return common.returnResult(true, 200, 'No guest cart items to merge');
        }

        let userCart = await Cart.findOne({ vendorId, userId, status: 'A' });
        if (!userCart) {
            userCart = new Cart({ vendorId, userId, products: [] });
        }

        // Guest line items win over a pre-existing identical line item in
        // the user's cart (confirmed: "keep the one from guest cart").
        // Anything only in the guest cart is appended as a new line.
        for (const gProduct of guestCart.products) {
            for (const gVariant of gProduct.variants) {
                for (const gSize of gVariant.sizes) {
                    const { productEntry, variantEntry, sizeEntry } = locateCartLineItem(userCart, gProduct.productId, gVariant.variantId, gSize.sizeId);

                    if (sizeEntry) {
                        sizeEntry.quantity = gSize.quantity;
                        sizeEntry.unitPrice = gSize.unitPrice;
                        sizeEntry.sku = gSize.sku;
                        sizeEntry.sizeName = gSize.sizeName;
                        continue;
                    }

                    let pEntry = userCart.products.find((p) => p.productId.toString() === gProduct.productId.toString());
                    if (!pEntry) {
                        userCart.products.push({
                            productId: gProduct.productId,
                            productName: gProduct.productName,
                            variants: [{ variantId: gVariant.variantId, variantName: gVariant.variantName, sizes: [gSize.toObject ? gSize.toObject() : gSize] }]
                        });
                    } else {
                        let vEntry = pEntry.variants.find((v) => v.variantId.toString() === gVariant.variantId.toString());
                        if (!vEntry) {
                            pEntry.variants.push({ variantId: gVariant.variantId, variantName: gVariant.variantName, sizes: [gSize.toObject ? gSize.toObject() : gSize] });
                        } else {
                            vEntry.sizes.push(gSize.toObject ? gSize.toObject() : gSize);
                        }
                    }
                }
            }
        }

        // Re-validate against current status/exclusions now that we know
        // the actual logged-in user's location (confirmed requirement 3).
        await revalidateCartItems(userCart, locationContext);

        // Enforce the per-vendor line-item cap. Pre-existing user-cart lines
        // are never evicted for this; only newly-merged-in guest lines are
        // dropped, from the end, until back within the limit (confirmed:
        // "silently drop the below products from guest cart").
        const limit = companyMasterData?.numberOfProductsAllowedInCartAtOnce ?? 50;
        let currentCount = countDistinctLineItems(userCart.products);
        if (currentCount > limit) {
            const guestKeys = new Set();
            for (const gProduct of guestCart.products) {
                for (const gVariant of gProduct.variants) {
                    for (const gSize of gVariant.sizes) {
                        guestKeys.add(`${gProduct.productId}:${gVariant.variantId}:${gSize.sizeId}`);
                    }
                }
            }

            outer:
            for (const productEntry of [...userCart.products]) {
                for (const variantEntry of [...productEntry.variants]) {
                    for (const sizeEntry of [...variantEntry.sizes]) {
                        if (currentCount <= limit) break outer;
                        const key = `${productEntry.productId}:${variantEntry.variantId}:${sizeEntry.sizeId}`;
                        if (guestKeys.has(key)) {
                            dropCartLineItem(userCart, { productEntry, variantEntry, sizeEntry }, 'CART_LIMIT_EXCEEDED',
                                `Removed because your cart's ${limit}-item limit was reached while merging your saved items.`);
                            currentCount--;
                        }
                    }
                }
            }
            pruneEmptyProducts(userCart);
        }

        userCart.createdBy = userCart.createdBy || userId;
        userCart.updatedBy = userId;
        await userCart.save();

        await Cart.deleteOne({ _id: guestCart._id });
        await invalidateCartTotalCache(vendorId, { type: 'user', id: userId });
        await invalidateCartTotalCache(vendorId, { type: 'guest', id: guestCartId });

        logger.logInfo(1, 0, 'Guest cart merged into user cart', { vendorId, userId, guestCartId });

        return common.returnResult(true, 200, 'Guest cart merged successfully', { cart: userCart });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| DISCOUNTS (checkbox-selected + optional coupon code)
|--------------------------------------------------------------------------
*/

// NOTE: PRODUCT_GROUP_*, CATEGORY_GROUP_*, USER_GROUP giveDiscountTo values
// are not resolvable yet - ProductGroup/CategoryGroup/UserGroup models
// don't exist in the codebase (same gap already flagged in
// discountService.js). Those discounts are treated as ineligible with an
// explanatory message until those models exist.
const resolveDiscountEligibility = (discount, cart, userId, subtotal, totalQuantity, productCategoryMap) => {
    if (discount.isDiscountForceClosed) {
        return { eligible: false, reason: discount.forceClosedReason || 'This discount is currently closed.' };
    }

    const now = new Date();
    if (!discount.isOngoingDiscount) {
        if (discount.startDate && now < discount.startDate) return { eligible: false, reason: 'This discount has not started yet.' };
        if (discount.endDate && now > discount.endDate) return { eligible: false, reason: 'This discount has expired.' };
    }

    if (discount.isDiscountOpenForSpecificDays) {
        const dayName = now.toLocaleString('en-US', { weekday: 'long', timeZone: discount.timezone || 'UTC' }).toUpperCase();
        if (!discount.specificDays.includes(dayName)) {
            return { eligible: false, reason: 'This discount is not available today.' };
        }
        if (discount.isDiscountOpenForSpecificHours) {
            const currentTime = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: discount.timezone || 'UTC' });
            if (currentTime < discount.specificHoursStartTime || currentTime > discount.specificHoursEndTime) {
                return { eligible: false, reason: 'This discount is not available at this time.' };
            }
        }
    }

    if (discount.discountValidAboveAmount > 0 && subtotal < discount.discountValidAboveAmount) {
        return { eligible: false, reason: `Add items worth ₹${discount.discountValidAboveAmount - subtotal} more to unlock this discount.` };
    }

    if (discount.isMinimumDiscountQuantityDiscount && totalQuantity < discount.minimumQuantity) {
        return { eligible: false, reason: `Add ${discount.minimumQuantity - totalQuantity} more item(s) to unlock this discount.` };
    }

    const needsSpecificUser = discount.giveDiscountTo.includes('SPECIFIC_USERS') || discount.giveDiscountTo === 'USER_GROUP';
    if (needsSpecificUser) {
        if (!userId) return { eligible: false, reason: 'Please log in to use this discount.' };
        if (discount.giveDiscountTo === 'USER_GROUP') {
            return { eligible: false, reason: 'This discount type is not supported yet.' };
        }
        if (!discount.userIds.some((id) => id.toString() === userId.toString())) {
            return { eligible: false, reason: 'This discount is not available for your account.' };
        }
    }

    if (discount.giveDiscountTo.includes('PRODUCT_GROUP') || discount.giveDiscountTo.includes('CATEGORY_GROUP')) {
        return { eligible: false, reason: 'This discount type is not supported yet.' };
    }

    // Determine matched line items -> the base amount the discount applies to.
    const allLineItems = [];
    for (const p of cart.products) {
        for (const v of p.variants) {
            for (const s of v.sizes) {
                allLineItems.push({ productId: p.productId, variantId: v.variantId, sizeId: s.sizeId, amount: s.unitPrice * s.quantity });
            }
        }
    }

    let matchedItems = [];
    if (discount.giveDiscountTo.startsWith('ALL_PRODUCTS')) {
        matchedItems = allLineItems;
    } else if (discount.giveDiscountTo.startsWith('PRODUCT_VARIANTS')) {
        matchedItems = allLineItems.filter((item) => discount.variantIds.some((id) => id.toString() === item.variantId.toString()));
    } else if (discount.giveDiscountTo.startsWith('SPECIFIC_PRODUCTS')) {
        matchedItems = allLineItems.filter((item) => discount.productIds.some((id) => id.toString() === item.productId.toString()));
    } else if (discount.giveDiscountTo.startsWith('SPECIFIC_CATEGORIES')) {
        matchedItems = allLineItems.filter((item) => {
            const categories = productCategoryMap.get(item.productId.toString()) || [];
            return categories.some((catId) => discount.categoryIds.some((id) => id.toString() === catId.toString()));
        });
    }

    if (matchedItems.length === 0) {
        return { eligible: false, reason: 'No items in your cart qualify for this discount.' };
    }

    const base = matchedItems.reduce((sum, item) => sum + item.amount, 0);
    let discountAmount = discount.discountType === 'PERCENTAGE'
        ? base * (discount.discountValue / 100)
        : discount.discountValue;
    discountAmount = Math.min(discountAmount, base);

    return { eligible: true, discountAmount };
};

const applyDiscountsToCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, payload) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isDiscountFeatureOn', 'isDiscountFeatureOn');
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(false, 400, 'Your cart is empty.');
        }

        const { discountIds = [], couponCode } = payload;
        const idFilters = [...discountIds];

        let couponDiscount = null;
        if (couponCode) {
            couponDiscount = await Discount.findOne({ vendorId, status: 'A', isCouponCodeDiscount: true, couponCode: couponCode.trim().toUpperCase() });
            if (!couponDiscount) {
                return common.returnResult(false, 404, 'Invalid coupon code.');
            }
            idFilters.push(couponDiscount._id.toString());
        }

        const candidates = await Discount.find({ _id: { $in: idFilters }, vendorId, status: 'A' });
        if (candidates.length === 0) {
            return common.returnResult(false, 404, 'No valid discounts found.');
        }

        const productIds = cart.products.map((p) => p.productId);
        const liveProducts = await Product.find({ _id: { $in: productIds } }, { mainCategory: 1, subCategory: 1 });
        const productCategoryMap = new Map(liveProducts.map((p) => [p._id.toString(), [p.mainCategory, p.subCategory].filter(Boolean)]));

        const { subtotal, totalQuantity } = computeCartSubtotal(cart);

        const applied = [];
        const rejected = [];

        for (const discount of candidates) {
            const result = resolveDiscountEligibility(discount, cart, userId, subtotal, totalQuantity, productCategoryMap);
            if (result.eligible) {
                applied.push({ discountId: discount._id, discountName: discount.name, discountAmount: Math.round(result.discountAmount * 100) / 100 });
            } else {
                rejected.push({ discountId: discount._id, discountName: discount.name, reason: result.reason });
            }
        }

        const totalDiscountAmount = Math.min(
            applied.reduce((sum, d) => sum + d.discountAmount, 0),
            subtotal
        );

        cart.discounts = applied;
        cart.totalDiscountAmount = totalDiscountAmount;
        cart.updatedBy = userId || null;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Discounts applied successfully', { cart, appliedDiscounts: applied, rejectedDiscounts: rejected });
    } catch (err) {
        throw err;
    }
};

const removeDiscountsFromCart = async (vendorId, cartOwner) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(false, 404, 'Cart not found.');
        }
        cart.discounts = [];
        cart.totalDiscountAmount = 0;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);
        return common.returnResult(true, 200, 'Discounts removed successfully', { cart });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| CHECKOUT
|--------------------------------------------------------------------------
| No Order model exists yet, so this endpoint's job is to produce a
| trustworthy, server-priced checkout snapshot on the Cart document itself
| (final per-item prices, live discount re-validation, computed tax) that a
| future Order-creation step can consume. It intentionally does NOT clear
| the cart or create an order.
*/

const checkoutCart = async (vendorId, cartOwner, userId, locationContext, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        if (cartOwner.type !== 'user') {
            return common.returnResult(false, 401, 'Please log in to checkout.');
        }

        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isCartFeatureOn', 'isCartFeatureOn');
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(false, 400, 'Your cart is empty.');
        }

        await revalidateCartItems(cart, locationContext);
        if (cart.products.length === 0) {
            await cart.save();
            return common.returnResult(false, 400, 'None of the items in your cart are currently available for checkout.');
        }

        const productIds = cart.products.map((p) => p.productId);
        const liveProducts = await Product.find({ _id: { $in: productIds } });
        const liveProductMap = new Map(liveProducts.map((p) => [p._id.toString(), p]));

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        const ineligibleItems = [];
        const eligibleLineItems = [];

        for (const productEntry of cart.products) {
            const liveProduct = liveProductMap.get(productEntry.productId.toString());
            for (const variantEntry of productEntry.variants) {
                const liveVariant = liveProduct.variants.id(variantEntry.variantId);
                for (const sizeEntry of variantEntry.sizes) {
                    const liveSize = liveVariant.sizes.id(sizeEntry.sizeId);

                    if (liveSize.stock < sizeEntry.quantity) {
                        sizeEntry.isCheckedOut = false;
                        ineligibleItems.push({
                            productName: productEntry.productName,
                            variantName: variantEntry.variantName,
                            sizeName: sizeEntry.sizeName,
                            reason: 'Insufficient stock. This item will remain in your cart.'
                        });
                        continue;
                    }

                    sizeEntry.unitPrice = liveSize.price;
                    sizeEntry.isCheckedOut = true;
                    eligibleLineItems.push({
                        productId: productEntry.productId,
                        variantId: variantEntry.variantId,
                        sizeId: sizeEntry.sizeId,
                        taxIds: liveProduct.taxIds || [],
                        amount: sizeEntry.unitPrice * sizeEntry.quantity
                    });
                }
            }
        }

        if (eligibleLineItems.length === 0) {
            await cart.save();
            return common.returnResult(false, 400, allowOutOfStock
                ? 'All items in your cart are currently out of stock.'
                : 'The items in your cart are currently out of stock.');
        }

        // Re-validate previously-applied discounts are still active.
        const droppedDiscounts = [];
        if (cart.discounts.length > 0) {
            const discountIds = cart.discounts.map((d) => d.discountId);
            const liveDiscounts = await Discount.find({ _id: { $in: discountIds } });
            const liveDiscountMap = new Map(liveDiscounts.map((d) => [d._id.toString(), d]));

            cart.discounts = cart.discounts.filter((d) => {
                const live = liveDiscountMap.get(d.discountId.toString());
                if (!live || live.status !== 'A') {
                    droppedDiscounts.push({ discountName: d.discountName, reason: 'This discount is no longer active.' });
                    return false;
                }
                return true;
            });
            cart.totalDiscountAmount = cart.discounts.reduce((sum, d) => sum + d.discountAmount, 0);
        }

        const eligibleSubtotal = eligibleLineItems.reduce((sum, i) => sum + i.amount, 0);

        // Tax: resolve each eligible line item's applicable TaxMaster docs
        // for the user's country/state (fallback to the country-wide
        // default when no state-specific tax exists), aggregated by taxId.
        const allTaxIds = [...new Set(eligibleLineItems.flatMap((i) => i.taxIds.map((id) => id.toString())))];
        const taxDocs = allTaxIds.length > 0
            ? await TaxMaster.find({ _id: { $in: allTaxIds }, status: 'A' })
            : [];
        const taxDocMap = new Map(taxDocs.map((t) => [t._id.toString(), t]));

        const taxTotals = new Map();
        for (const item of eligibleLineItems) {
            for (const taxId of item.taxIds) {
                const taxDoc = taxDocMap.get(taxId.toString());
                if (!taxDoc) continue;
                // Country/state applicability check.
                if (locationContext.countryId && taxDoc.countryId.toString() !== locationContext.countryId.toString()) continue;
                if (taxDoc.stateId && locationContext.stateId && taxDoc.stateId.toString() !== locationContext.stateId.toString()) continue;

                const taxAmount = taxDoc.taxType === 'percentage'
                    ? item.amount * (taxDoc.totalRate / 100)
                    : taxDoc.totalRate;

                const existing = taxTotals.get(taxDoc._id.toString());
                if (existing) {
                    existing.taxAmount += taxAmount;
                } else {
                    taxTotals.set(taxDoc._id.toString(), { taxId: taxDoc._id, taxName: taxDoc.name, taxRate: taxDoc.totalRate, taxAmount });
                }
            }
        }

        cart.taxes = Array.from(taxTotals.values()).map((t) => ({ ...t, taxAmount: Math.round(t.taxAmount * 100) / 100 }));
        cart.totalTaxAmount = Math.round(cart.taxes.reduce((sum, t) => sum + t.taxAmount, 0) * 100) / 100;
        cart.totalFreeCashAmount = 0; // FreeCash not implemented yet.
        cart.checkedOutDate = new Date();
        cart.updatedBy = userId;

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        const grandTotal = eligibleSubtotal - cart.totalDiscountAmount + cart.totalTaxAmount;

        logger.logInfo(1, 0, 'Cart checkout summary generated', { vendorId, userId });

        return common.returnResult(true, 200, 'Checkout summary generated successfully', {
            cart,
            eligibleSubtotal,
            grandTotal: Math.round(grandTotal * 100) / 100,
            ineligibleItems,
            droppedDiscounts
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    addProductToCart,
    updateCartItemQuantity,
    removeCartItem,
    getCart,
    mergeGuestCartIntoUserCart,
    applyDiscountsToCart,
    removeDiscountsFromCart,
    checkoutCart
};
