const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const TaxMaster = require('../models/TaxMaster');
const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');
const shippingPriceCalculationService = require('./shippingPriceCalculationService');
const freeCashService = require('./freeCashService');

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
            if (size.stock == 0) {
                return common.returnResult(false, 400, `Size ${size.sizeName} of variant ${variant.displayName} is out of stock.`);    
            }
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
                labelValue: size.labelValue || null,
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
            const variantName = resolved.variant.displayName || resolved.variant.color || 'Default';

        if (resolved.size.stock === 0) {
            return common.returnResult(
                false,
                400,
                `${variantName} - ${resolved.size.sizeName} is out of stock.`
            );
        }
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
                    sizeEntry.labelValue = liveSize.labelValue || null;
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
// availableForThreshold is subtotal minus whatever Free Cash is already
// applied to the cart - a discount's own discountValidAboveAmount is
// checked against THIS, not the raw subtotal, so applying a Free Cash
// first can push a discount's own minimum out of reach (and vice versa -
// see applyFreeCashToCart). discountAmount itself is still computed off
// the raw matched line-item totals below, only the eligibility gate uses
// the reduced amount.
const resolveDiscountEligibility = (discount, cart, userId, subtotal, availableForThreshold, totalQuantity, productCategoryMap) => {
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

    if (discount.discountValidAboveAmount > 0 && availableForThreshold < discount.discountValidAboveAmount) {
        return { eligible: false, reason: `Add items worth ₹${discount.discountValidAboveAmount - availableForThreshold} more to unlock this discount.` };
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

        // A Free Cash already applied with canBeUsedWithOtherDiscounts false
        // blocks discounts entirely, not just a specific one.
        if ((cart.freeCash || []).some((f) => f.canBeUsedWithOtherDiscounts !== true)) {
            return common.returnResult(false, 400, 'A Free Cash that cannot be combined with discounts is already applied. Remove it first.');
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
        const availableForThreshold = subtotal - (cart.totalFreeCashAmount || 0);

        const applied = [];
        const rejected = [];

        for (const discount of candidates) {
            const result = resolveDiscountEligibility(discount, cart, userId, subtotal, availableForThreshold, totalQuantity, productCategoryMap);
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
| FREE CASH
|--------------------------------------------------------------------------
| Mirrors the DISCOUNTS section above. giveFreeCashTo === 'SPECIFIC_USERS'
| or 'GROUPS' campaigns already have their UserFreeCash grants created
| eagerly by freeCashService.createFreeCash (Pass 1). 'ALL_USERS' and the
| category-restricted options do NOT - eligibility for those is resolved
| here, lazily, the first time this user's cart becomes eligible, via
| freeCashService.issueUserFreeCash (so the isFreeCashStackingAllowed
| expire-others behavior stays centralized in one place).
*/

// True if any cart line item's product falls under this FreeCash campaign's
// selected category/categories. ALL_USERS is not category-restricted and
// never reaches here.
const cartMatchesFreeCashCategory = (cart, freeCashDoc, productCategoryMap) => {
    const mainIds = new Set((freeCashDoc.mainCategoryIds || []).map((id) => id.toString()));
    const subIds = new Set((freeCashDoc.subCategoryIds || []).map((id) => id.toString()));

    return cart.products.some((p) => {
        const categories = productCategoryMap.get(p.productId.toString()) || [];
        if (freeCashDoc.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY' && subIds.size > 0) {
            return categories.some((catId) => subIds.has(catId.toString()));
        }
        return categories.some((catId) => mainIds.has(catId.toString()));
    });
};

// Returns the list of currently-usable UserFreeCash grants for this user -
// pre-existing ones (SPECIFIC_USERS/GROUPS, issued at campaign-creation
// time) plus lazily-issued ones for any ALL_USERS/category-restricted
// campaign this user is eligible for but doesn't hold a grant for yet.
const resolveEligibleUserFreeCash = async (vendorId, userId, cart, productCategoryMap, companySettingsData) => {
    const now = new Date();

    const existingGrants = await UserFreeCash.find({
        vendorId,
        userId,
        isCashExpired: false,
        isRevoked: false,
        status: 'A',
        remainingAmount: { $gt: 0 }
    }).populate('freeCashId');

    const validGrants = existingGrants.filter((grant) => {
        const fc = grant.freeCashId;
        return fc && fc.status === 'A' && now >= fc.startDate && now <= fc.endDate;
    });

    const grantedFreeCashIds = new Set(validGrants.map((g) => g.freeCashId._id.toString()));

    const lazyCandidates = await FreeCash.find({
        vendorId,
        status: 'A',
        giveFreeCashTo: { $in: ['ALL_USERS', 'ONLY_MAIN_CATEGORY', 'MAIN_CATEGORY_AND_SUB_CATEGORY'] },
        startDate: { $lte: now },
        endDate: { $gte: now }
    });

    for (const fc of lazyCandidates) {
        if (grantedFreeCashIds.has(fc._id.toString())) continue;

        if (fc.giveFreeCashTo !== 'ALL_USERS' && !cartMatchesFreeCashCategory(cart, fc, productCategoryMap)) {
            continue;
        }

        await freeCashService.issueUserFreeCash(vendorId, fc, [userId], userId, companySettingsData);
        const freshGrant = await UserFreeCash.findOne({ vendorId, freeCashId: fc._id, userId }).sort({ createdAt: -1 });
        if (freshGrant) {
            // A plain wrapper (not freshGrant.freeCashId = fc) - assigning a
            // full document to a Mongoose ObjectId ref path silently casts
            // it back down to just the id, discarding freeCashName/etc.
            validGrants.push({ _id: freshGrant._id, remainingAmount: freshGrant.remainingAmount, freeCashId: fc });
        }
    }

    return validGrants;
};

const applyFreeCashToCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData, payload) => {
    try {
        if (!userId) {
            return common.returnResult(false, 401, 'Please log in to use Free Cash.');
        }

        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isFreeCashFeatureOn', 'isFreeCashFeatureOn');
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }
        if (!companySettingsData || companySettingsData.isFreeCashFeatureOn !== true) {
            return common.returnResult(false, 403, 'Free Cash is not enabled for this store.');
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(false, 400, 'Your cart is empty.');
        }

        const { freeCashIds = [] } = payload;
        if (freeCashIds.length === 0) {
            return common.returnResult(false, 400, 'Select at least one Free Cash to apply.');
        }

        const multipleAllowed = companySettingsData.isMultipleFreeCashUsageAllowed === true;
        if (!multipleAllowed && freeCashIds.length > 1) {
            return common.returnResult(false, 400, 'Only one Free Cash can be applied at a time for this store.');
        }

        const productIds = cart.products.map((p) => p.productId);
        const liveProducts = await Product.find({ _id: { $in: productIds } }, { mainCategory: 1, subCategory: 1 });
        const productCategoryMap = new Map(liveProducts.map((p) => [p._id.toString(), [p.mainCategory, p.subCategory].filter(Boolean)]));

        const eligibleGrants = await resolveEligibleUserFreeCash(vendorId, userId, cart, productCategoryMap, companySettingsData);
        const eligibleMap = new Map(eligibleGrants.map((g) => [g.freeCashId._id.toString(), g]));

        const { subtotal } = computeCartSubtotal(cart);
        const hasActiveDiscount = cart.discounts.length > 0;

        const applied = [];
        const rejected = [];
        let runningAvailable = subtotal - (hasActiveDiscount ? cart.totalDiscountAmount : 0);

        for (const freeCashId of freeCashIds) {
            const grant = eligibleMap.get(freeCashId.toString());
            if (!grant) {
                rejected.push({ freeCashId, reason: 'This Free Cash is not available for your account.' });
                continue;
            }
            const fc = grant.freeCashId;

            if (!multipleAllowed && applied.length > 0) {
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason: 'Only one Free Cash can be applied at a time for this store.' });
                continue;
            }

            if (hasActiveDiscount && fc.canBeUsedWithOtherDiscounts !== true) {
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason: 'This Free Cash cannot be combined with an active discount. Remove the discount first.' });
                continue;
            }

            if (fc.validAbove > 0 && runningAvailable < fc.validAbove) {
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason: `Add items worth ₹${fc.validAbove - runningAvailable} more to unlock this Free Cash.` });
                continue;
            }

            const cap = (fc.maxCashUsagePerOrder !== null && fc.maxCashUsagePerOrder !== undefined)
                ? Math.min(grant.remainingAmount, fc.maxCashUsagePerOrder)
                : grant.remainingAmount;

            const amountApplied = Math.min(cap, runningAvailable);
            if (amountApplied <= 0) {
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason: 'No cart amount remaining to apply this Free Cash against.' });
                continue;
            }

            applied.push({
                freeCashId: fc._id,
                userFreeCashId: grant._id,
                freeCashName: fc.freeCashName,
                canBeUsedWithOtherDiscounts: fc.canBeUsedWithOtherDiscounts === true,
                amountApplied: Math.round(amountApplied * 100) / 100
            });

            runningAvailable -= amountApplied;
        }

        if (applied.length === 0) {
            return common.returnResult(false, 400, 'None of the selected Free Cash could be applied.', { rejected });
        }

        cart.freeCash = applied;
        cart.totalFreeCashAmount = Math.round(applied.reduce((sum, f) => sum + f.amountApplied, 0) * 100) / 100;
        cart.updatedBy = userId;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Free Cash applied successfully', { cart, appliedFreeCash: applied, rejectedFreeCash: rejected });
    } catch (err) {
        throw err;
    }
};

const removeFreeCashFromCart = async (vendorId, cartOwner, userId) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(false, 404, 'Cart not found.');
        }
        cart.freeCash = [];
        cart.totalFreeCashAmount = 0;
        cart.updatedBy = userId || null;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);
        return common.returnResult(true, 200, 'Free Cash removed successfully', { cart });
    } catch (err) {
        throw err;
    }
};

// Storefront listing - what Free Cash could this user apply to their
// current cart right now, without actually applying anything.
const listEligibleFreeCashForCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        if (!userId) {
            return common.returnResult(true, 200, 'Log in to view available Free Cash', { data: [] });
        }

        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isFreeCashFeatureOn', 'isFreeCashFeatureOn');
        if (!featureCheck.isSuccess || !companySettingsData || companySettingsData.isFreeCashFeatureOn !== true) {
            return common.returnResult(true, 200, 'Free Cash is not enabled', { data: [] });
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(true, 200, 'Cart is empty', { data: [] });
        }

        const productIds = cart.products.map((p) => p.productId);
        const liveProducts = await Product.find({ _id: { $in: productIds } }, { mainCategory: 1, subCategory: 1 });
        const productCategoryMap = new Map(liveProducts.map((p) => [p._id.toString(), [p.mainCategory, p.subCategory].filter(Boolean)]));

        const grants = await resolveEligibleUserFreeCash(vendorId, userId, cart, productCategoryMap, companySettingsData);

        const data = grants.map((g) => ({
            freeCashId: g.freeCashId._id,
            freeCashName: g.freeCashId.freeCashName,
            remainingAmount: g.remainingAmount,
            validAbove: g.freeCashId.validAbove,
            maxCashUsagePerOrder: g.freeCashId.maxCashUsagePerOrder,
            canBeUsedWithOtherDiscounts: g.freeCashId.canBeUsedWithOtherDiscounts === true
        }));

        return common.returnResult(true, 200, 'Eligible Free Cash fetched successfully', { data });
    } catch (err) {
        throw err;
    }
};

// Called once, at order-creation commit time (orderService.createOrderFromCart)
// with the cart's final, checkout-revalidated cart.freeCash array - draws
// down each grant's remainingAmount and records a cashUsageHistory entry
// against the real orderId. isStoringRemainingFreeCashAmountAllowed=false
// forfeits any leftover balance immediately instead of carrying it forward.
const consumeFreeCashForOrder = async (vendorId, appliedFreeCash, orderId, userId, companySettingsData) => {
    try {
        if (!Array.isArray(appliedFreeCash) || appliedFreeCash.length === 0) return;

        const storeRemaining = companySettingsData ? companySettingsData.isStoringRemainingFreeCashAmountAllowed === true : false;
        const now = new Date();

        for (const f of appliedFreeCash) {
            const grant = await UserFreeCash.findOne({ _id: f.userFreeCashId, vendorId });
            if (!grant) continue; // checkoutCart already re-validated this moments earlier

            const amountUsed = Math.min(f.amountApplied, grant.remainingAmount);
            const newRemaining = storeRemaining ? (grant.remainingAmount - amountUsed) : 0;

            grant.usedAmount += amountUsed;
            grant.remainingAmount = newRemaining;
            grant.isCashUsed = newRemaining <= 0;
            grant.cashUsageHistory.push({ amountUsed, remainingAmount: newRemaining, usedDate: now, orderId });
            grant.updatedBy = userId;
            await grant.save();
        }
    } catch (err) {
        throw err;
    }
};

// Called from orderReturnService.markReturnRefunded (the same moment
// Order.refundAmount is incremented) - refunds the portion of this order's
// Free Cash usage attributable to the items in this specific return back
// onto the original UserFreeCash grant(s)' remainingAmount, so partially
// returning an order only unlocks a proportional refund, not the whole
// order's Free Cash. Silently no-ops (never errors) when the feature is
// off anywhere in the 2-layer admin gate or the vendor's own setting - a
// disabled Free-Cash-refund sub-feature should never block the return
// itself from completing.
const refundFreeCashForReturn = async (vendorId, order, orderReturn, companyMasterData, websiteMasterData, companySettingsData, adminUserId) => {
    try {
        if (!websiteMasterData || websiteMasterData.isFreeCashRefundFeatureOn !== true) return;
        if (!companyMasterData || companyMasterData.isFreeCashRefundFeatureOn !== true) return;
        if (!companyMasterData || companyMasterData.isFreeCashFeatureOn !== true) return;
        if (!companySettingsData || companySettingsData.returnFreeCashOnOrderReturn !== true) return;

        if (!order.totalFreeCashAmount || order.totalFreeCashAmount <= 0) return;
        if (!order.subtotal || order.subtotal <= 0) return;

        const cart = await Cart.findById(order.cartId);
        if (!cart || !cart.freeCash || cart.freeCash.length === 0) return;

        const refundPercentage = companySettingsData.refundWholeFreeCashAmount === true
            ? 100
            : (companySettingsData.amountToRefund || 0);
        if (refundPercentage <= 0) return;

        // What share of the order's total product value this specific
        // return covers - the same share of the order's total Free Cash
        // usage is what becomes eligible for a refund.
        const returnedShare = Math.min(orderReturn.totalRefundAmount / order.subtotal, 1);
        if (returnedShare <= 0) return;

        const eligibleFreeCashPool = order.totalFreeCashAmount * returnedShare;
        const totalToRefund = Math.round(eligibleFreeCashPool * (refundPercentage / 100) * 100) / 100;
        if (totalToRefund <= 0) return;

        const now = new Date();

        for (const f of cart.freeCash) {
            // This specific grant's own share of the refund pool,
            // proportional to how much of the order's total Free Cash
            // usage it originally contributed.
            const grantShare = (f.amountApplied / order.totalFreeCashAmount) * totalToRefund;
            if (grantShare <= 0) continue;

            const grant = await UserFreeCash.findOne({ _id: f.userFreeCashId, vendorId });
            if (!grant) continue;

            // Never refund back more than is currently outstanding as used
            // on this grant (usedAmount already excludes anything refunded
            // by an earlier return).
            const cappedRefund = Math.round(Math.min(grantShare, grant.usedAmount) * 100) / 100;
            if (cappedRefund <= 0) continue;

            grant.usedAmount = Math.round((grant.usedAmount - cappedRefund) * 100) / 100;
            grant.remainingAmount = Math.min(
                Math.round((grant.remainingAmount + cappedRefund) * 100) / 100,
                grant.amount
            );
            if (grant.remainingAmount > 0 && !grant.isRevoked && !grant.isCashExpired) {
                grant.isCashUsed = false;
            }
            grant.cashRefundHistory.push({
                amountRefunded: cappedRefund,
                remainingAmount: grant.remainingAmount,
                refundedDate: now,
                orderReturnId: orderReturn._id
            });
            grant.updatedBy = adminUserId;
            await grant.save();
        }
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

const checkoutCart = async (vendorId, cartOwner, userId, locationContext, companyMasterData, websiteMasterData, companySettingsData, shippingPriceSettingsData) => {
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
                        amount: sizeEntry.unitPrice * sizeEntry.quantity,
                        quantity: sizeEntry.quantity,
                        shippingType: liveSize.shipping?.type || null,
                        shippingValue: liveSize.shipping?.type === 'CUSTOM' ? liveSize.shipping.value : null,
                        mainCategoryId: liveProduct.mainCategory,
                        subCategoryId: liveProduct.subCategory,
                        weight: liveSize.weight || null
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

        // Re-validate previously-applied Free Cash is still active, not
        // revoked/expired, and still has enough remaining balance - same
        // re-check discipline as the discounts block above.
        const droppedFreeCash = [];
        if (cart.freeCash.length > 0) {
            const userFreeCashIds = cart.freeCash.map((f) => f.userFreeCashId);
            const liveGrants = await UserFreeCash.find({ _id: { $in: userFreeCashIds } }).populate('freeCashId');
            const liveGrantMap = new Map(liveGrants.map((g) => [g._id.toString(), g]));
            const now = new Date();

            cart.freeCash = cart.freeCash.filter((f) => {
                const grant = liveGrantMap.get(f.userFreeCashId.toString());
                const fcDoc = grant && grant.freeCashId;
                const stillValid = grant && !grant.isCashExpired && !grant.isRevoked && grant.status === 'A'
                    && fcDoc && fcDoc.status === 'A' && now >= fcDoc.startDate && now <= fcDoc.endDate
                    && grant.remainingAmount >= f.amountApplied;

                if (!stillValid) {
                    droppedFreeCash.push({ freeCashName: f.freeCashName, reason: 'This Free Cash is no longer available.' });
                }
                return stillValid;
            });
            cart.totalFreeCashAmount = Math.round(cart.freeCash.reduce((sum, f) => sum + f.amountApplied, 0) * 100) / 100;
        } else {
            cart.totalFreeCashAmount = 0;
        }

        cart.checkedOutDate = new Date();
        cart.updatedBy = userId;

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        const shippingResult = await shippingPriceCalculationService.calculateShippingPriceAmount({
            lineItems: eligibleLineItems,
            subtotal: eligibleSubtotal,
            shippingPriceSettings: shippingPriceSettingsData,
            locationContext,
            companyMasterData,
            websiteMasterData
        });
        const shippingAmount = shippingResult.meta.shippingAmount;

        // Discount + Free Cash together can never take the order below zero,
        // regardless of how each was individually capped at apply-time.
        const totalDeductions = Math.min(cart.totalDiscountAmount + cart.totalFreeCashAmount, eligibleSubtotal);
        const grandTotal = eligibleSubtotal - totalDeductions + cart.totalTaxAmount + shippingAmount;

        logger.logInfo(1, 0, 'Cart checkout summary generated', { vendorId, userId });

        return common.returnResult(true, 200, 'Checkout summary generated successfully', {
            cart,
            eligibleSubtotal,
            shippingAmount,
            shippingBreakdown: shippingResult.meta.breakdown,
            grandTotal: Math.round(grandTotal * 100) / 100,
            ineligibleItems,
            droppedDiscounts,
            droppedFreeCash
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
    applyFreeCashToCart,
    removeFreeCashFromCart,
    listEligibleFreeCashForCart,
    consumeFreeCashForOrder,
    refundFreeCashForReturn,
    checkoutCart
};
