const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const Category = require('../models/Category');
const Group = require('../models/Group');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');
const shippingPriceCalculationService = require('./shippingPriceCalculationService');
const freeCashService = require('./freeCashService');
const discountUsageService = require('./discountUsageService');
const abandonedCartService = require('./abandonedCartService');
const bulkPricing = require('../utils/bulkPricing');
const { checkDaysAndHoursWindow } = require('../utils/discountSchedule');
const taxCalculationService = require('./taxCalculationService');
const currencyService = require('./currencyService');
const promotionEmailService = require('./promotionEmailService');
const lowStockAlertService = require('./lowStockAlertService');
const { EMAIL_MODULES } = require('../constants/emailModuleConstants');

// Formats a store-currency amount for a shopper's message, in the currency
// they see prices in (their country's, converted). Falls back to the plain
// number if the store currency isn't configured - a message never fails the request.
const resolveMoneyFormatter = async (countryId, companyMasterData, companySettingsData) => {
    try {
        const currencyResult = await currencyService.resolveCustomerCurrency({ countryId, companyMasterData, companySettingsData });
        return currencyResult.isSuccess
            ? currencyService.buildMoneyFormatter(currencyResult.meta)
            : (amount) => String(Math.round(amount * 100) / 100);
    } catch (err) {
        throw err;
    }
};

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

const findOrCreateActiveCart = async (vendorId, cartOwner, possibleUserId = null) => {
    const filter = { vendorId, status: 'A', ...ownerFilter(cartOwner) };
    let cart = await Cart.findOne(filter);
    if (!cart) {
        cart = await Cart.create({
            vendorId,
            ...ownerFilter(cartOwner),
            // Only ever meaningful for a guest cart - see Cart.possibleUserId.
            possibleUserId: cartOwner.type === 'guest' ? possibleUserId : null,
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

// Writes the quantity-dependent price (bulk tier or normal) onto a cart size
// line. Returns true if the stored price actually changed.
const applyLinePrice = (sizeEntry, product, variant, size, isBulkPricingOn) => {
    try {
        const pricing = bulkPricing.resolveUnitPrice(product, variant, size, sizeEntry.quantity, isBulkPricingOn);
        const changed = sizeEntry.unitPrice !== pricing.unitPrice
            || sizeEntry.originalUnitPrice !== pricing.originalUnitPrice
            || sizeEntry.isBulkPriceApplied !== pricing.isBulkPriceApplied;
        sizeEntry.unitPrice = pricing.unitPrice;
        sizeEntry.originalUnitPrice = pricing.originalUnitPrice;
        sizeEntry.isBulkPriceApplied = pricing.isBulkPriceApplied;
        return changed;
    } catch (err) {
        throw err;
    }
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

const addProductToCart = async (vendorId, cartOwner, locationContext, companyMasterData, websiteMasterData, companySettingsData, payload, possibleUserId = null) => {
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

        const cart = await findOrCreateActiveCart(vendorId, cartOwner, possibleUserId);

        // Refresh the hint on every add, not just at cart creation - covers
        // a cart that already existed before this login (or before this
        // feature shipped), and keeps it current if a different known user
        // ever shares this browser.
        if (cartOwner.type === 'guest' && possibleUserId) {
            cart.possibleUserId = possibleUserId;
        }

        const { sizeEntry: existingSizeEntry } = locateCartLineItem(cart, productId, variantId, sizeId);
        const requestedTotalQty = (existingSizeEntry ? existingSizeEntry.quantity : 0) + quantity;

        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        if (!allowOutOfStock && size.stock < requestedTotalQty) {
            if (size.stock == 0) {
                return common.returnResult(false, 400, `Size ${size.sizeName} of variant ${variant.displayName} is out of stock.`);    
            }
            return common.returnResult(false, 400, `Only ${size.stock} unit(s) of this size are in stock.`);
        }

        if (existingSizeEntry) {
            existingSizeEntry.quantity = requestedTotalQty;
            applyLinePrice(existingSizeEntry, product, variant, size, isBulkPricingOn);
        } else {
            const currentLineItemCount = countDistinctLineItems(cart.products);
            const limit = companyMasterData?.numberOfProductsAllowedInCartAtOnce ?? 50;
            if (currentLineItemCount + 1 > limit) {
                return common.returnResult(false, 400, `You can only have ${limit} distinct items in your cart at once. Please remove an item before adding a new one.`);
            }

            const pricing = bulkPricing.resolveUnitPrice(product, variant, size, quantity, isBulkPricingOn);
            const sizeLine = {
                sizeId: size._id,
                sizeName: size.sizeName,
                labelValue: size.labelValue || null,
                unitPrice: pricing.unitPrice,
                originalUnitPrice: pricing.originalUnitPrice,
                isBulkPriceApplied: pricing.isBulkPriceApplied,
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

        // Stamped for both owner types - Pass 2 also tracks abandonment for
        // guest carts that carry a possibleUserId hint (see
        // abandonedCartService.js's scanner for where that's actually
        // decided; this just keeps the activity clock current either way).
        const wasAbandoned = abandonedCartService.markCartActivity(cart);

        // A changed cart total can change what the discounts and Free Cash take off.
        await recalculateCartPromotions(vendorId, cart, cartLines(cart), companyMasterData, websiteMasterData, companySettingsData);
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        if (wasAbandoned) {
            abandonedCartService.notifyCartRecovered(vendorId, cart);
        }

        return common.returnResult(true, 200, 'Product added to cart successfully', { cart });
    } catch (err) {
        throw err;
    }
};

const updateCartItemQuantity = async (vendorId, cartOwner, companyMasterData, websiteMasterData, companySettingsData, payload) => {
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
            return removeCartItem(vendorId, cartOwner, { productId, variantId, sizeId }, companyMasterData, websiteMasterData, companySettingsData);
        }

        const resolved = await resolveActiveProductLine(vendorId, productId, variantId, sizeId);
        if (resolved.error) {
            return common.returnResult(false, 404, resolved.error);
        }

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        if (!allowOutOfStock && resolved.size.stock < quantity) {
            const variantName = resolved.variant.displayName || resolved.variant.color || 'Default';

        // availableStock lets the storefront set the quantity to what's left
        // when the shopper typed more than that (see cartController.updateCartItem).
        if (resolved.size.stock === 0) {
            return common.returnResult(
                false,
                400,
                `${variantName} - ${resolved.size.sizeName} is out of stock.`,
                { availableStock: 0 }
            );
        }
            return common.returnResult(false, 400, `Only ${resolved.size.stock} unit(s) of this size are in stock.`, { availableStock: resolved.size.stock });
        }

        sizeEntry.quantity = quantity;
        // Snapshot price may have moved since it was first added, and the new
        // quantity may enter or leave a bulk pricing tier - refresh it.
        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        applyLinePrice(sizeEntry, resolved.product, resolved.variant, resolved.size, isBulkPricingOn);
        await recalculateCartPromotions(vendorId, cart, cartLines(cart), companyMasterData, websiteMasterData, companySettingsData);

        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Cart item quantity updated successfully', { cart });
    } catch (err) {
        throw err;
    }
};

const removeCartItem = async (vendorId, cartOwner, payload, companyMasterData, websiteMasterData, companySettingsData) => {
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
        await recalculateCartPromotions(vendorId, cart, cartLines(cart), companyMasterData, websiteMasterData, companySettingsData);

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
// why into cart.removedItems. Also re-prices every kept line (bulk tier or
// normal price). Returns true if the cart was mutated.
const revalidateCartItems = async (cart, locationContext, isBulkPricingOn) => {
    if (cart.products.length === 0) return false;

    const productIds = cart.products.map((p) => p.productId);
    const liveProducts = await Product.find({ _id: { $in: productIds } });
    const liveProductMap = new Map(liveProducts.map((p) => [p._id.toString(), p]));

    let mutated = false;
    let priceChanged = false;

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
                    if (applyLinePrice(sizeEntry, liveProduct, liveVariant, liveSize, isBulkPricingOn)) {
                        priceChanged = true;
                    }
                    sizeEntry.sizeName = liveSize.sizeName;
                    sizeEntry.labelValue = liveSize.labelValue || null;
                }
            }
        }
    }

    if (mutated) {
        pruneEmptyProducts(cart);
    }

    // A price change alone must also be saved, or the cached cart total
    // would keep the old price.
    return mutated || priceChanged;
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

const getCart = async (vendorId, cartOwner, locationContext, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(true, 200, 'Cart is empty', {
                cart: null,
                subtotal: 0,
                totalQuantity: 0
            });
        }

        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        const mutated = await revalidateCartItems(cart, locationContext, isBulkPricingOn);
        // Re-checked on every fetch too - a discount or Free Cash grant can
        // expire, be revoked or be used up without the cart itself changing.
        const promotionResult = await recalculateCartPromotions(vendorId, cart, cartLines(cart), companyMasterData, websiteMasterData, companySettingsData);
        if (mutated || promotionResult.changed) {
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

const mergeGuestCartIntoUserCart = async (vendorId, userId, guestCartId, locationContext, companyMasterData, websiteMasterData) => {
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

        // A line item in BOTH carts (same product/variant/size) has its
        // quantities added together (2 saved + 2 as guest = 4); the guest's
        // snapshot fields are kept and revalidateCartItems below re-prices
        // from the live product for the new total. Anything only in the
        // guest cart is appended as a new line.
        for (const gProduct of guestCart.products) {
            for (const gVariant of gProduct.variants) {
                for (const gSize of gVariant.sizes) {
                    const { productEntry, variantEntry, sizeEntry } = locateCartLineItem(userCart, gProduct.productId, gVariant.variantId, gSize.sizeId);

                    if (sizeEntry) {
                        sizeEntry.quantity += gSize.quantity;
                        sizeEntry.unitPrice = gSize.unitPrice;
                        sizeEntry.originalUnitPrice = gSize.originalUnitPrice;
                        sizeEntry.isBulkPriceApplied = gSize.isBulkPriceApplied;
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
        // Also re-prices every line, since a merged quantity can change which
        // bulk pricing tier applies.
        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        await revalidateCartItems(userCart, locationContext, isBulkPricingOn);

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
| DISCOUNTS (picked from the eligible list, or entered as a coupon code)
|--------------------------------------------------------------------------
| Logged-in customers only. The cart page lists every discount this customer
| can use on this cart right now (listEligibleDiscountsForCart - coupon
| discounts are never listed, only reachable by their code); they pick any
| mix, as long as a discount with isMultipleDiscountUsageOn off is on its own.
|
| Usage limits (isDiscountReusable/discountReusableNumber per customer,
| numberOfUsersCanUseDiscount, firstOrderOnly) are checked here and claimed
| for real when the order is placed - see services/discountUsageService.js.
| Payment-method discounts are never usable yet (no payment gateway).
|
| discountValidAboveAmount is checked against the cart total minus whatever
| Free Cash is applied; minimumQuantity counts only the items the discount
| applies to. A FIXED_PRICE discount comes off once per order, never more
| than the items it applies to are worth.
*/

const LOGIN_TO_USE_DISCOUNTS = 'Please log in to use discounts.';
const NOT_AVAILABLE_FOR_ACCOUNT = 'This discount is not available for your account.';

const isDiscountEnabled = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        if (!websiteMasterData || !companyMasterData) return false;
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isDiscountFeatureOn', 'isDiscountFeatureOn');
        return featureCheck.isSuccess;
    } catch (err) {
        throw err;
    }
};

// The cart's lines in the shape the discount/Free Cash math runs on.
const cartLines = (cart) => {
    try {
        const lines = [];
        for (const p of cart.products) {
            for (const v of p.variants) {
                for (const s of v.sizes) {
                    lines.push({
                        productId: p.productId,
                        productName: p.productName,
                        variantId: v.variantId,
                        sizeId: s.sizeId,
                        quantity: s.quantity,
                        amount: s.unitPrice * s.quantity
                    });
                }
            }
        }
        return lines;
    } catch (err) {
        throw err;
    }
};

const idIn = (ids, id) => {
    try {
        return (ids || []).some((x) => x.toString() === id.toString());
    } catch (err) {
        throw err;
    }
};

const loadDiscountGroups = async (vendorId, discounts) => {
    try {
        const groupIds = new Set();
        for (const d of discounts) {
            [...(d.productGroupIds || []), ...(d.categoryGroupIds || []), ...(d.userGroupIds || [])]
                .forEach((id) => groupIds.add(id.toString()));
        }
        if (groupIds.size === 0) return new Map();
        const groups = await Group.find({ _id: { $in: [...groupIds] }, vendorId, status: 'A' }, { groupType: 1, members: 1 });
        return new Map(groups.map((g) => [g._id.toString(), g]));
    } catch (err) {
        throw err;
    }
};

// Members of the given groups that are of groupType - read live, so a
// discount follows its groups as they change.
const groupMembers = (groupIds, groupMap, groupType) => {
    try {
        const members = new Set();
        for (const id of groupIds || []) {
            const group = groupMap.get(id.toString());
            if (group && group.groupType === groupType) {
                (group.members || []).forEach((m) => members.add(m.toString()));
            }
        }
        return members;
    } catch (err) {
        throw err;
    }
};

// Everything resolveDiscountEligibility needs besides the discount, loaded once per request.
const buildDiscountContext = async ({ vendorId, userId, discounts, lines, freeCashAmount, formatMoney }) => {
    try {
        const productCategoryMap = await loadProductCategoryMap(lines.map((l) => l.productId));
        const groupMap = await loadDiscountGroups(vendorId, discounts);
        const usageByDiscount = await discountUsageService.countUsageByUser(vendorId, userId, discounts.map((d) => d._id));
        const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
        return {
            userId,
            lines,
            productCategoryMap,
            groupMap,
            usageByDiscount,
            subtotal,
            availableForThreshold: subtotal - (freeCashAmount || 0),
            formatMoney
        };
    } catch (err) {
        throw err;
    }
};

// Storewide targeting (every item in the cart) vs product/category-specific.
const appliesToWholeCart = (discount) => {
    try {
        return discount.giveDiscountTo.startsWith('ALL_PRODUCTS') || discount.giveDiscountTo === 'USER_GROUP';
    } catch (err) {
        throw err;
    }
};

// The cart lines a discount applies to.
const matchDiscountLines = (discount, ctx) => {
    try {
        const target = discount.giveDiscountTo;
        const categoriesOf = (line) => ctx.productCategoryMap.get(line.productId.toString()) || [];

        if (appliesToWholeCart(discount)) return ctx.lines;
        if (target.startsWith('SPECIFIC_PRODUCTS')) return ctx.lines.filter((l) => idIn(discount.productIds, l.productId));
        if (target.startsWith('SPECIFIC_CATEGORIES')) {
            return ctx.lines.filter((l) => categoriesOf(l).some((catId) => idIn(discount.categoryIds, catId)));
        }
        if (target.startsWith('PRODUCT_GROUP')) {
            const productIds = groupMembers(discount.productGroupIds, ctx.groupMap, 'PRODUCT');
            return ctx.lines.filter((l) => productIds.has(l.productId.toString()));
        }
        if (target.startsWith('CATEGORY_GROUP')) {
            const categoryIds = groupMembers(discount.categoryGroupIds, ctx.groupMap, 'CATEGORY');
            return ctx.lines.filter((l) => categoriesOf(l).some((catId) => categoryIds.has(catId.toString())));
        }
        return [];
    } catch (err) {
        throw err;
    }
};

// Why an ineligible discount failed, for the cart page's list: a customer is
// shown a discount they could unlock (LOCK_CART: add more / the right items;
// LOCK_SCHEDULE: only open on certain days/hours) greyed out with the reason.
// Anything else (not theirs, used up, expired, closed) is never shown.
const DISCOUNT_LOCK = { CART: 'CART', SCHEDULE: 'SCHEDULE' };

// { eligible, discountAmount, matchedLines } or { eligible: false, reason, lock? }.
// Order matters: who-may-use-it and usage limits come before the schedule and
// cart checks, so a `lock` is only ever reported to a customer the discount is really for.
const resolveDiscountEligibility = (discount, ctx) => {
    try {
        const { userId, formatMoney } = ctx;
        if (!userId) return { eligible: false, reason: LOGIN_TO_USE_DISCOUNTS };

        if (discount.isDiscountForceClosed) {
            return { eligible: false, reason: discount.forceClosedReason || 'This discount is currently closed.' };
        }

        const now = ctx.now || new Date();
        if (!discount.isOngoingDiscount) {
            if (discount.startDate && now < discount.startDate) return { eligible: false, reason: 'This discount has not started yet.' };
            if (discount.endDate && now > discount.endDate) return { eligible: false, reason: 'This discount has expired.' };
        }

        if (discount.isDiscountBasedOnPaymentMethods) {
            return { eligible: false, reason: 'This discount depends on the payment method and is not available yet.' };
        }
        if (discount.giveDiscountTo.startsWith('PRODUCT_VARIANTS')) {
            return { eligible: false, reason: 'This discount type is not supported yet.' };
        }

        // Who may use it.
        if (discount.giveDiscountTo.includes('SPECIFIC_USERS') && !idIn(discount.userIds, userId)) {
            return { eligible: false, reason: NOT_AVAILABLE_FOR_ACCOUNT };
        }
        if (discount.giveDiscountTo === 'USER_GROUP'
            && !groupMembers(discount.userGroupIds, ctx.groupMap, 'USER').has(userId.toString())) {
            return { eligible: false, reason: NOT_AVAILABLE_FOR_ACCOUNT };
        }

        // Usage limits.
        if (discount.firstOrderOnly) {
            if (idIn(discount.firstOrderExcludedUserIds, userId)) return { eligible: false, reason: NOT_AVAILABLE_FOR_ACCOUNT };
            if (discount.isDiscountUsedForFirstTime) return { eligible: false, reason: 'This discount has already been claimed.' };
        }
        const customerLimit = discount.numberOfUsersCanUseDiscount;
        if (customerLimit !== null && customerLimit !== undefined
            && !idIn(discount.usedByUserIds, userId) && (discount.usedByUserIds || []).length >= customerLimit) {
            return { eligible: false, reason: 'This discount has reached its limit of customers.' };
        }
        const allowedUses = discount.isDiscountReusable ? discount.discountReusableNumber : 1;
        const timesUsed = ctx.usageByDiscount.get(discount._id.toString()) || 0;
        if (allowedUses !== null && allowedUses !== undefined && timesUsed >= allowedUses) {
            return { eligible: false, reason: allowedUses === 1 ? 'You have already used this discount.' : `You have already used this discount ${allowedUses} times.` };
        }

        // When it is open (days / hours, in the discount's own timezone).
        const window = checkDaysAndHoursWindow(discount, now);
        if (!window.open) {
            return { eligible: false, reason: window.reason, lock: DISCOUNT_LOCK.SCHEDULE };
        }

        // What in the cart it applies to.
        const matchedLines = matchDiscountLines(discount, ctx);
        if (matchedLines.length === 0) {
            return { eligible: false, reason: 'No items in your cart qualify for this discount.', lock: DISCOUNT_LOCK.CART };
        }

        // The minimum spend counts only the items the discount applies to (the
        // whole cart for a storewide one), less their share of any Free Cash.
        const matchedAmount = matchedLines.reduce((sum, l) => sum + l.amount, 0);
        if (discount.discountValidAboveAmount > 0) {
            const freeCashTotal = Math.max(ctx.subtotal - ctx.availableForThreshold, 0);
            const freeCashShare = ctx.subtotal > 0 ? freeCashTotal * (matchedAmount / ctx.subtotal) : 0;
            const qualifyingAmount = Math.round((matchedAmount - freeCashShare) * 100) / 100;
            if (qualifyingAmount < discount.discountValidAboveAmount) {
                const shortBy = formatMoney(Math.round((discount.discountValidAboveAmount - qualifyingAmount) * 100) / 100);
                return {
                    eligible: false,
                    reason: appliesToWholeCart(discount)
                        ? `Add items worth ${shortBy} more to unlock this discount.`
                        : `Add eligible items worth ${shortBy} more to unlock this discount.`,
                    lock: DISCOUNT_LOCK.CART
                };
            }
        }

        if (discount.isMinimumDiscountQuantityDiscount && discount.minimumQuantity) {
            const matchedQuantity = matchedLines.reduce((sum, l) => sum + l.quantity, 0);
            if (matchedQuantity < discount.minimumQuantity) {
                return {
                    eligible: false,
                    reason: `Add ${discount.minimumQuantity - matchedQuantity} more qualifying item(s) to unlock this discount.`,
                    lock: DISCOUNT_LOCK.CART
                };
            }
        }

        const rawAmount = discount.discountType === 'PERCENTAGE'
            ? matchedAmount * (discount.discountValue / 100)
            : discount.discountValue;
        const discountAmount = Math.round(Math.min(rawAmount, matchedAmount) * 100) / 100;

        return { eligible: true, discountAmount, matchedLines };
    } catch (err) {
        throw err;
    }
};

// A discount with isMultipleDiscountUsageOn off must be the only one on the
// order. Returns the first such discount among several, or null.
const findUncombinableDiscount = (discounts) => {
    try {
        if (discounts.length < 2) return null;
        return discounts.find((d) => d.isMultipleDiscountUsageOn !== true) || null;
    } catch (err) {
        throw err;
    }
};

const toCartDiscount = (discount, discountAmount) => {
    try {
        return {
            discountId: discount._id,
            discountName: discount.name,
            discountAmount
        };
    } catch (err) {
        throw err;
    }
};

const sumAppliedDiscounts = (applied, subtotal) => {
    try {
        return Math.round(Math.min(applied.reduce((sum, d) => sum + d.discountAmount, 0), subtotal) * 100) / 100;
    } catch (err) {
        throw err;
    }
};

// Re-works the discounts already on the cart against the given lines (the
// cart's own, or checkout's in-stock ones) - same idea as
// recalculateAppliedFreeCash. Drops anything that no longer qualifies.
// Mutates cart.discounts/totalDiscountAmount but does not save.
const recalculateAppliedDiscounts = async (vendorId, cart, lines, companyMasterData, websiteMasterData, formatMoney = (amount) => String(amount)) => {
    try {
        const previous = cart.discounts || [];
        if (previous.length === 0) {
            const changed = (cart.totalDiscountAmount || 0) !== 0;
            cart.totalDiscountAmount = 0;
            return { changed, dropped: [] };
        }

        const userId = cart.userId || null;
        const applied = [];
        const dropped = [];

        const enabled = await isDiscountEnabled(vendorId, websiteMasterData, companyMasterData);
        if (!enabled || !userId) {
            const reason = enabled ? LOGIN_TO_USE_DISCOUNTS : 'Discounts are not available right now.';
            previous.forEach((d) => dropped.push({ discountName: d.discountName, reason }));
        } else {
            const liveDiscounts = await Discount.find({ _id: { $in: previous.map((d) => d.discountId) }, vendorId, status: 'A' });
            const liveById = new Map(liveDiscounts.map((d) => [d._id.toString(), d]));
            const ctx = await buildDiscountContext({ vendorId, userId, discounts: liveDiscounts, lines, freeCashAmount: cart.totalFreeCashAmount, formatMoney });

            const stillEligible = [];
            for (const d of previous) {
                const live = liveById.get(d.discountId.toString());
                if (!live) {
                    dropped.push({ discountName: d.discountName, reason: 'This discount is no longer active.' });
                    continue;
                }
                const result = resolveDiscountEligibility(live, ctx);
                if (!result.eligible) {
                    dropped.push({ discountName: d.discountName, reason: result.reason });
                    continue;
                }
                stillEligible.push({ discount: live, discountAmount: result.discountAmount });
            }

            // Only possible if the admin changed a discount after it was applied.
            const combinable = stillEligible.length > 1
                ? stillEligible.filter((e) => {
                    if (e.discount.isMultipleDiscountUsageOn === true) return true;
                    dropped.push({ discountName: e.discount.name, reason: 'This discount can\'t be combined with other discounts.' });
                    return false;
                })
                : stillEligible;
            combinable.forEach((e) => applied.push(toCartDiscount(e.discount, e.discountAmount)));
        }

        const changed = applied.length !== previous.length
            || applied.some((d, index) => d.discountId.toString() !== previous[index].discountId.toString()
                || d.discountAmount !== previous[index].discountAmount);

        const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
        cart.discounts = applied;
        cart.totalDiscountAmount = sumAppliedDiscounts(applied, subtotal);
        return { changed, dropped };
    } catch (err) {
        throw err;
    }
};

// Discounts first (they don't depend on the lines' Free Cash split), then
// Free Cash against what is left. Used by every place the cart's lines change.
const recalculateCartPromotions = async (vendorId, cart, lines, companyMasterData, websiteMasterData, companySettingsData, formatMoney) => {
    try {
        const discountResult = await recalculateAppliedDiscounts(vendorId, cart, lines, companyMasterData, websiteMasterData, formatMoney);
        const freeCashResult = await recalculateAppliedFreeCash(vendorId, cart, lines, companyMasterData, websiteMasterData, companySettingsData, formatMoney);
        return {
            changed: discountResult.changed || freeCashResult.changed,
            droppedDiscounts: discountResult.dropped,
            droppedFreeCash: freeCashResult.dropped
        };
    } catch (err) {
        throw err;
    }
};

// A running (not expired, not yet-to-start, not force-closed) discount -
// what "live" means for the coupon lookup and the coupon-box check.
const isDiscountLive = (discount, now = new Date()) => {
    try {
        if (discount.isDiscountForceClosed) return false;
        if (discount.isOngoingDiscount) return true;
        if (discount.startDate && now < discount.startDate) return false;
        if (discount.endDate && now > discount.endDate) return false;
        return true;
    } catch (err) {
        throw err;
    }
};

// The discount a typed coupon code refers to. A code can be reused once its
// old discount has expired (see discountService.checkCouponCodeAvailability),
// so several discounts may share it - the live one wins; otherwise the
// newest, so the shopper is told why it can't be used ("has expired").
const findCouponDiscount = async (vendorId, couponCode) => {
    try {
        const matches = await Discount.find({
            vendorId,
            status: 'A',
            isCouponCodeDiscount: true,
            couponCode: String(couponCode).trim().toUpperCase()
        }).sort({ createdAt: -1 });
        if (matches.length === 0) return null;
        return matches.find((d) => isDiscountLive(d)) || matches[0];
    } catch (err) {
        throw err;
    }
};

// countryId + companySettingsData only format amounts in messages (shopper's currency).
const applyDiscountsToCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, payload, countryId = null, companySettingsData = null) => {
    try {
        if (!userId) {
            return common.returnResult(false, 401, LOGIN_TO_USE_DISCOUNTS);
        }

        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isDiscountFeatureOn', 'isDiscountFeatureOn');
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(false, 400, 'Your cart is empty.');
        }
        const formatMoney = await resolveMoneyFormatter(countryId, companyMasterData, companySettingsData);

        // A Free Cash already applied with canBeUsedWithOtherDiscounts false
        // blocks discounts entirely, not just a specific one.
        if ((cart.freeCash || []).some((f) => f.canBeUsedWithOtherDiscounts !== true)) {
            return common.returnResult(false, 400, 'A Free Cash that cannot be combined with discounts is already applied. Remove it first.');
        }

        const { discountIds = [], couponCode } = payload;
        const rejected = [];

        let couponDiscount = null;
        if (couponCode) {
            couponDiscount = await findCouponDiscount(vendorId, couponCode);
            if (!couponDiscount) {
                return common.returnResult(false, 404, 'Invalid coupon code.');
            }
        }

        // A coupon discount is only reachable by its code - by id only once
        // it is already on the cart (so re-applying keeps it).
        const onCart = new Set(cart.discounts.map((d) => d.discountId.toString()));
        const byId = discountIds.length > 0
            ? await Discount.find({ _id: { $in: discountIds }, vendorId, status: 'A' })
            : [];
        const candidates = [];
        for (const discount of byId) {
            if (discount.isCouponCodeDiscount && !onCart.has(discount._id.toString())) {
                rejected.push({ discountId: discount._id, discountName: discount.name, reason: 'Enter the coupon code to use this discount.' });
                continue;
            }
            candidates.push(discount);
        }
        if (couponDiscount && !candidates.some((d) => d._id.toString() === couponDiscount._id.toString())) {
            candidates.push(couponDiscount);
        }
        if (candidates.length === 0 && rejected.length === 0) {
            return common.returnResult(false, 404, 'No valid discounts found.');
        }

        const lines = cartLines(cart);
        const ctx = await buildDiscountContext({ vendorId, userId, discounts: candidates, lines, freeCashAmount: cart.totalFreeCashAmount, formatMoney });

        const eligible = [];
        for (const discount of candidates) {
            const result = resolveDiscountEligibility(discount, ctx);
            if (result.eligible) {
                eligible.push({ discount, discountAmount: result.discountAmount });
            } else {
                rejected.push({ discountId: discount._id, discountName: discount.name, reason: result.reason });
            }
        }

        const uncombinable = findUncombinableDiscount(eligible.map((e) => e.discount));
        if (uncombinable) {
            return common.returnResult(false, 400, `"${uncombinable.name}" can't be combined with other discounts. Apply it on its own.`);
        }

        if (eligible.length === 0) {
            const message = rejected.length === 1 ? rejected[0].reason : 'None of the selected discounts could be applied.';
            return common.returnResult(false, 400, message, { rejected });
        }

        const applied = eligible.map((e) => toCartDiscount(e.discount, e.discountAmount));
        cart.discounts = applied;
        cart.totalDiscountAmount = sumAppliedDiscounts(applied, ctx.subtotal);
        // What a discount takes off changes how much Free Cash still fits.
        await recalculateAppliedFreeCash(vendorId, cart, lines, companyMasterData, websiteMasterData, companySettingsData, formatMoney);
        cart.updatedBy = userId;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);

        return common.returnResult(true, 200, 'Discounts applied successfully', { cart, appliedDiscounts: applied, rejectedDiscounts: rejected });
    } catch (err) {
        throw err;
    }
};

const removeDiscountsFromCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart) {
            return common.returnResult(false, 404, 'Cart not found.');
        }
        cart.discounts = [];
        cart.totalDiscountAmount = 0;
        await recalculateAppliedFreeCash(vendorId, cart, cartLines(cart), companyMasterData, websiteMasterData, companySettingsData);
        cart.updatedBy = userId || null;
        await cart.save();
        await invalidateCartTotalCache(vendorId, cartOwner);
        return common.returnResult(true, 200, 'Discounts removed successfully', { cart });
    } catch (err) {
        throw err;
    }
};

// Storefront listing - every discount this customer could apply to their
// cart right now, with what it would take off, followed by the ones meant for
// them that the cart can't use yet (isLocked, with lockedReason: "Add items
// worth X more", "Only available on Monday"). Coupon discounts come
// separately in `coupons` (same shape, never the code - it must still be
// typed in); hasCouponDiscounts says whether a coupon box is worth showing.
// isEnabled / requiresLogin tell the cart page what to render.
const listEligibleDiscountsForCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData, countryId = null) => {
    try {
        const response = { isEnabled: false, requiresLogin: false, hasCouponDiscounts: false, discounts: [], coupons: [] };

        const enabled = await isDiscountEnabled(vendorId, websiteMasterData, companyMasterData);
        if (!enabled) {
            return common.returnResult(true, 200, 'Discounts are not enabled', response);
        }
        response.isEnabled = true;

        if (!userId) {
            response.requiresLogin = true;
            return common.returnResult(true, 200, 'Log in to view available discounts', response);
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(true, 200, 'Cart is empty', response);
        }

        const now = new Date();
        const running = await Discount.find({
            vendorId,
            status: 'A',
            isDiscountForceClosed: { $ne: true },
            isDiscountBasedOnPaymentMethods: { $ne: true },
            $and: [
                { $or: [{ isOngoingDiscount: true }, { endDate: null }, { endDate: { $gte: now } }] },
                { $or: [{ isOngoingDiscount: true }, { startDate: null }, { startDate: { $lte: now } }] }
            ]
        }).sort({ precedence: -1, createdAt: -1 });
        const candidates = running.filter((d) => d.isCouponCodeDiscount !== true);
        const coupons = running.filter((d) => d.isCouponCodeDiscount === true);

        const formatMoney = await resolveMoneyFormatter(countryId, companyMasterData, companySettingsData);
        const ctx = await buildDiscountContext({ vendorId, userId, discounts: running, lines: cartLines(cart), freeCashAmount: cart.totalFreeCashAmount, formatMoney });

        // The coupons this customer could use - now, or once the cart qualifies
        // (never one that isn't theirs, used up or closed). Listed so they know
        // what's on offer and how much more to add, but WITHOUT the code: it
        // still has to be entered (applying a coupon by id is refused).
        for (const coupon of coupons) {
            const result = resolveDiscountEligibility(coupon, ctx);
            if (!result.eligible && !result.lock) continue;
            response.coupons.push({
                discountId: coupon._id,
                name: coupon.name,
                description: coupon.description || '',
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: result.eligible ? result.discountAmount : 0,
                discountValidAboveAmount: coupon.discountValidAboveAmount || 0,
                minimumQuantity: coupon.isMinimumDiscountQuantityDiscount ? coupon.minimumQuantity : null,
                endDate: coupon.isOngoingDiscount ? null : coupon.endDate,
                appliesToWholeCart: appliesToWholeCart(coupon),
                isMultipleDiscountUsageOn: coupon.isMultipleDiscountUsageOn === true,
                isLocked: !result.eligible,
                lockedReason: result.eligible ? null : result.reason
            });
        }
        response.hasCouponDiscounts = response.coupons.length > 0;

        const locked = [];
        for (const discount of candidates) {
            const result = resolveDiscountEligibility(discount, ctx);
            if (!result.eligible) {
                if (result.lock) {
                    locked.push({
                        discountId: discount._id,
                        name: discount.name,
                        description: discount.description || '',
                        discountType: discount.discountType,
                        discountValue: discount.discountValue,
                        discountAmount: 0,
                        discountValidAboveAmount: discount.discountValidAboveAmount || 0,
                        minimumQuantity: discount.isMinimumDiscountQuantityDiscount ? discount.minimumQuantity : null,
                        endDate: discount.isOngoingDiscount ? null : discount.endDate,
                        autoApply: false,
                        isMultipleDiscountUsageOn: discount.isMultipleDiscountUsageOn === true,
                        firstOrderOnly: discount.firstOrderOnly === true,
                        validOnItems: [],
                        appliesToWholeCart: appliesToWholeCart(discount),
                        isLocked: true,
                        lockedReason: result.reason
                    });
                }
                continue;
            }

            const appliesToEverything = appliesToWholeCart(discount);
            response.discounts.push({
                discountId: discount._id,
                name: discount.name,
                description: discount.description || '',
                discountType: discount.discountType,
                discountValue: discount.discountValue,
                // What it would take off this cart right now.
                discountAmount: result.discountAmount,
                discountValidAboveAmount: discount.discountValidAboveAmount || 0,
                minimumQuantity: discount.isMinimumDiscountQuantityDiscount ? discount.minimumQuantity : null,
                endDate: discount.isOngoingDiscount ? null : discount.endDate,
                autoApply: discount.autoApply === true,
                isMultipleDiscountUsageOn: discount.isMultipleDiscountUsageOn === true,
                firstOrderOnly: discount.firstOrderOnly === true,
                // Names of the cart items it applies to (empty = the whole cart).
                validOnItems: appliesToEverything ? [] : [...new Set(result.matchedLines.map((l) => l.productName))],
                appliesToWholeCart: appliesToEverything,
                isLocked: false,
                lockedReason: null
            });
        }
        // Usable ones first, then the ones still to unlock.
        response.discounts.push(...locked);

        return common.returnResult(true, 200, 'Eligible discounts fetched successfully', response);
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
| category-restricted options do NOT - each customer is given one grant,
| lazily, the first time their cart becomes eligible, via
| freeCashService.issueUserFreeCash (without expiring their other grants).
|
| A category-restricted campaign is worked out against the cart lines in
| its categories only: its validAbove is checked against, and its amount
| capped at, the total of those lines - never the whole cart.
*/

const CATEGORY_FREE_CASH_TYPES = ['ONLY_MAIN_CATEGORY', 'MAIN_CATEGORY_AND_SUB_CATEGORY'];

const isCategoryFreeCash = (freeCashDoc) => {
    try {
        return CATEGORY_FREE_CASH_TYPES.includes(freeCashDoc.giveFreeCashTo);
    } catch (err) {
        throw err;
    }
};

// Stacking off means a customer holds one grant at a time, so applying
// several is only possible when both settings are on.
const isMultipleFreeCashAllowed = (companySettingsData) => {
    try {
        return !!companySettingsData
            && companySettingsData.isFreeCashStackingAllowed === true
            && companySettingsData.isMultipleFreeCashUsageAllowed === true;
    } catch (err) {
        throw err;
    }
};

const isFreeCashEnabled = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        if (!websiteMasterData || !companyMasterData || !companySettingsData) return false;
        const featureCheck = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isFreeCashFeatureOn', 'isFreeCashFeatureOn');
        return featureCheck.isSuccess && companySettingsData.isFreeCashFeatureOn === true;
    } catch (err) {
        throw err;
    }
};

// A grant (with freeCashId populated) that can still be drawn from right now.
const isGrantUsable = (grant, now) => {
    try {
        const fc = grant && grant.freeCashId;
        return !!grant && !grant.isCashExpired && !grant.isRevoked && grant.status === 'A' && grant.remainingAmount > 0
            && !!fc && fc.status === 'A' && now >= fc.startDate && now <= fc.endDate;
    } catch (err) {
        throw err;
    }
};

const loadProductCategoryMap = async (productIds) => {
    try {
        const liveProducts = await Product.find({ _id: { $in: productIds } }, { mainCategory: 1, subCategory: 1 });
        return new Map(liveProducts.map((p) => [p._id.toString(), [p.mainCategory, p.subCategory].filter(Boolean)]));
    } catch (err) {
        throw err;
    }
};

// Whether a line counts towards this campaign - every line for a campaign
// that is not category-restricted.
const lineMatchesFreeCash = (line, freeCashDoc, productCategoryMap) => {
    try {
        if (!isCategoryFreeCash(freeCashDoc)) return true;

        const categories = productCategoryMap.get(line.productId.toString()) || [];
        const subIds = new Set((freeCashDoc.subCategoryIds || []).map((id) => id.toString()));
        if (freeCashDoc.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY' && subIds.size > 0) {
            return categories.some((catId) => subIds.has(catId.toString()));
        }
        const mainIds = new Set((freeCashDoc.mainCategoryIds || []).map((id) => id.toString()));
        return categories.some((catId) => mainIds.has(catId.toString()));
    } catch (err) {
        throw err;
    }
};

// Works out, in the given order, how much of each chosen Free Cash applies
// to these lines. grantMap is freeCashId -> usable grant (freeCashId
// populated). Each applied amount is taken off the lines it covers, so two
// campaigns on the same category can never deduct more than those lines
// are worth. An active discount is taken off the cart total first.
const allocateFreeCash = ({ freeCashIds, grantMap, lines, productCategoryMap, discounts, totalDiscountAmount, multipleAllowed, formatMoney }) => {
    try {
        const lineRemaining = lines.map((l) => l.amount);
        const subtotal = lineRemaining.reduce((sum, amount) => sum + amount, 0);
        const hasActiveDiscount = (discounts || []).length > 0;
        let runningAvailable = subtotal - (hasActiveDiscount ? (totalDiscountAmount || 0) : 0);

        const applied = [];
        const rejected = [];

        for (const freeCashId of freeCashIds) {
            const grant = grantMap.get(freeCashId.toString());
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

            const matchingIndexes = lines
                .map((line, index) => (lineMatchesFreeCash(line, fc, productCategoryMap) ? index : -1))
                .filter((index) => index !== -1);
            const matchingAvailable = matchingIndexes.reduce((sum, index) => sum + lineRemaining[index], 0);
            const available = Math.max(Math.min(matchingAvailable, runningAvailable), 0);

            if (fc.validAbove > 0 && available < fc.validAbove) {
                const scope = isCategoryFreeCash(fc) ? ' from the eligible categories' : '';
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason: `Add items worth ${formatMoney(fc.validAbove - available)} more${scope} to unlock this Free Cash.` });
                continue;
            }

            const cap = (fc.maxCashUsagePerOrder !== null && fc.maxCashUsagePerOrder !== undefined)
                ? Math.min(grant.remainingAmount, fc.maxCashUsagePerOrder)
                : grant.remainingAmount;

            const amountApplied = Math.round(Math.min(cap, available) * 100) / 100;
            if (amountApplied <= 0) {
                const reason = isCategoryFreeCash(fc)
                    ? 'Your cart has no items from the categories this Free Cash is valid on.'
                    : 'No cart amount remaining to apply this Free Cash against.';
                rejected.push({ freeCashId, freeCashName: fc.freeCashName, reason });
                continue;
            }

            let toDeduct = amountApplied;
            for (const index of matchingIndexes) {
                if (toDeduct <= 0) break;
                const taken = Math.min(lineRemaining[index], toDeduct);
                lineRemaining[index] -= taken;
                toDeduct -= taken;
            }
            runningAvailable -= amountApplied;

            applied.push({
                freeCashId: fc._id,
                userFreeCashId: grant._id,
                freeCashName: fc.freeCashName,
                canBeUsedWithOtherDiscounts: fc.canBeUsedWithOtherDiscounts === true,
                amountApplied
            });
        }

        return { applied, rejected };
    } catch (err) {
        throw err;
    }
};

const sumAppliedFreeCash = (applied) => {
    try {
        return Math.round(applied.reduce((sum, f) => sum + f.amountApplied, 0) * 100) / 100;
    } catch (err) {
        throw err;
    }
};

// Returns the list of currently-usable UserFreeCash grants for this user -
// pre-existing ones (SPECIFIC_USERS/GROUPS, issued at campaign-creation
// time) plus lazily-issued ones for any ALL_USERS/category-restricted
// campaign this user is eligible for and has never been given.
const resolveEligibleUserFreeCash = async (vendorId, userId, cart, productCategoryMap, companySettingsData) => {
    try {
        const now = new Date();

        const existingGrants = await UserFreeCash.find({
            vendorId,
            userId,
            isCashExpired: false,
            isRevoked: false,
            status: 'A',
            remainingAmount: { $gt: 0 }
        }).populate('freeCashId');

        const validGrants = existingGrants.filter((grant) => isGrantUsable(grant, now));

        // GROUPS campaigns follow their groups live: someone who joined a
        // group after the campaign was created gets it here, like everyone else.
        const lazyCandidates = await FreeCash.find({
            vendorId,
            status: 'A',
            giveFreeCashTo: { $in: ['ALL_USERS', 'GROUPS', ...CATEGORY_FREE_CASH_TYPES] },
            startDate: { $lte: now },
            endDate: { $gte: now }
        });
        if (lazyCandidates.length === 0) return validGrants;

        const groupCampaignIds = lazyCandidates.filter((fc) => fc.giveFreeCashTo === 'GROUPS').flatMap((fc) => fc.userGroupIds || []);
        const myActiveGroupIds = groupCampaignIds.length > 0
            ? new Set((await Group.find({ _id: { $in: groupCampaignIds }, vendorId, groupType: 'USER', status: 'A', members: userId }).distinct('_id')).map((id) => id.toString()))
            : new Set();

        // Any grant this customer ever had for a campaign - used up, expired or
        // revoked included - means they were already given it once.
        const issuedFreeCashIds = await UserFreeCash.distinct('freeCashId', {
            vendorId,
            userId,
            freeCashId: { $in: lazyCandidates.map((fc) => fc._id) }
        });
        const alreadyIssued = new Set(issuedFreeCashIds.map((id) => id.toString()));
        const lines = cartLines(cart);

        for (const fc of lazyCandidates) {
            if (alreadyIssued.has(fc._id.toString())) continue;

            if (fc.giveFreeCashTo === 'GROUPS' && !(fc.userGroupIds || []).some((id) => myActiveGroupIds.has(id.toString()))) {
                continue;
            }
            if (isCategoryFreeCash(fc) && !lines.some((line) => lineMatchesFreeCash(line, fc, productCategoryMap))) {
                continue;
            }

            // Idempotent (one grant per customer per campaign), so two cart
            // requests arriving together can't hand it out twice.
            await freeCashService.issueUserFreeCash(vendorId, fc, [userId], userId, companySettingsData, null, false);
            const freshGrant = await UserFreeCash.findOne({ vendorId, freeCashId: fc._id, userId });
            if (freshGrant && !freshGrant.isRevoked && !freshGrant.isCashExpired && freshGrant.remainingAmount > 0) {
                // A plain wrapper (not freshGrant.freeCashId = fc) - assigning a
                // full document to a Mongoose ObjectId ref path silently casts
                // it back down to just the id, discarding freeCashName/etc.
                validGrants.push({ _id: freshGrant._id, remainingAmount: freshGrant.remainingAmount, freeCashId: fc });
            }
        }

        return validGrants;
    } catch (err) {
        throw err;
    }
};

// Re-works the Free Cash already on the cart against the given lines
// (the cart's own, or checkout's in-stock ones). Called whenever the cart's
// lines change and at checkout, so an applied amount never outlives the
// cart it was worked out for; anything that no longer qualifies is dropped.
// Mutates cart.freeCash/totalFreeCashAmount but does not save. Returns
// { changed, dropped: [{ freeCashName, reason }] }.
const recalculateAppliedFreeCash = async (vendorId, cart, lines, companyMasterData, websiteMasterData, companySettingsData, formatMoney = (amount) => String(amount)) => {
    try {
        const previous = cart.freeCash || [];
        if (previous.length === 0) {
            const changed = (cart.totalFreeCashAmount || 0) !== 0;
            cart.totalFreeCashAmount = 0;
            return { changed, dropped: [] };
        }

        const nameById = new Map(previous.map((f) => [f.freeCashId.toString(), f.freeCashName]));
        let applied = [];
        let rejected = [];

        const enabled = await isFreeCashEnabled(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!enabled) {
            rejected = previous.map((f) => ({ freeCashId: f.freeCashId, reason: 'Free Cash is not available right now.' }));
        } else {
            const grants = await UserFreeCash.find({ _id: { $in: previous.map((f) => f.userFreeCashId) }, vendorId }).populate('freeCashId');
            const now = new Date();
            const grantMap = new Map();
            for (const grant of grants) {
                if (isGrantUsable(grant, now)) grantMap.set(grant.freeCashId._id.toString(), grant);
            }

            const productCategoryMap = await loadProductCategoryMap(lines.map((l) => l.productId));
            ({ applied, rejected } = allocateFreeCash({
                freeCashIds: previous.map((f) => f.freeCashId),
                grantMap,
                lines,
                productCategoryMap,
                discounts: cart.discounts,
                totalDiscountAmount: cart.totalDiscountAmount,
                multipleAllowed: isMultipleFreeCashAllowed(companySettingsData),
                formatMoney
            }));
            rejected = rejected.map((r) => (r.reason === 'This Free Cash is not available for your account.'
                ? { ...r, reason: 'This Free Cash is no longer available.' }
                : r));
        }

        const changed = applied.length !== previous.length
            || applied.some((f, index) => f.userFreeCashId.toString() !== previous[index].userFreeCashId.toString()
                || f.amountApplied !== previous[index].amountApplied);

        cart.freeCash = applied;
        cart.totalFreeCashAmount = sumAppliedFreeCash(applied);

        const dropped = rejected.map((r) => ({
            freeCashName: r.freeCashName || nameById.get(r.freeCashId.toString()) || 'Free Cash',
            reason: r.reason
        }));
        return { changed, dropped };
    } catch (err) {
        throw err;
    }
};

// countryId only formats amounts in messages (shopper's currency).
const applyFreeCashToCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData, payload, countryId = null) => {
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
        const formatMoney = await resolveMoneyFormatter(countryId, companyMasterData, companySettingsData);

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(false, 400, 'Your cart is empty.');
        }

        const { freeCashIds = [] } = payload;
        if (freeCashIds.length === 0) {
            return common.returnResult(false, 400, 'Select at least one Free Cash to apply.');
        }

        const multipleAllowed = isMultipleFreeCashAllowed(companySettingsData);
        if (!multipleAllowed && freeCashIds.length > 1) {
            return common.returnResult(false, 400, 'Only one Free Cash can be applied at a time for this store.');
        }

        const productCategoryMap = await loadProductCategoryMap(cart.products.map((p) => p.productId));
        const eligibleGrants = await resolveEligibleUserFreeCash(vendorId, userId, cart, productCategoryMap, companySettingsData);
        const grantMap = new Map(eligibleGrants.map((g) => [g.freeCashId._id.toString(), g]));

        const { applied, rejected } = allocateFreeCash({
            freeCashIds,
            grantMap,
            lines: cartLines(cart),
            productCategoryMap,
            discounts: cart.discounts,
            totalDiscountAmount: cart.totalDiscountAmount,
            multipleAllowed,
            formatMoney
        });

        if (applied.length === 0) {
            // A single rejection's own reason ("Add items worth X more...") says more than the generic message.
            const message = rejected.length === 1 ? rejected[0].reason : 'None of the selected Free Cash could be applied.';
            return common.returnResult(false, 400, message, { rejected });
        }

        cart.freeCash = applied;
        cart.totalFreeCashAmount = sumAppliedFreeCash(applied);
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
// current cart right now, without actually applying anything. isEnabled /
// requiresLogin / isMultipleFreeCashUsageAllowed tell the cart page what to
// render (nothing, a login prompt, a single choice or multiple choices).
// countryId only formats amounts in messages (shopper's currency).
const listEligibleFreeCashForCart = async (vendorId, cartOwner, userId, companyMasterData, websiteMasterData, companySettingsData, countryId = null) => {
    try {
        const response = {
            isEnabled: false,
            requiresLogin: false,
            isMultipleFreeCashUsageAllowed: isMultipleFreeCashAllowed(companySettingsData),
            freeCash: []
        };

        const enabled = await isFreeCashEnabled(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!enabled) {
            return common.returnResult(true, 200, 'Free Cash is not enabled', response);
        }
        response.isEnabled = true;

        if (!userId) {
            response.requiresLogin = true;
            return common.returnResult(true, 200, 'Log in to view available Free Cash', response);
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(true, 200, 'Cart is empty', response);
        }

        const productCategoryMap = await loadProductCategoryMap(cart.products.map((p) => p.productId));
        const grants = await resolveEligibleUserFreeCash(vendorId, userId, cart, productCategoryMap, companySettingsData);

        // Names of the categories a category-restricted campaign is valid on,
        // for "Valid on: ..." in the cart.
        const categoryIds = new Set();
        for (const g of grants) {
            if (!isCategoryFreeCash(g.freeCashId)) continue;
            const ids = g.freeCashId.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY' && (g.freeCashId.subCategoryIds || []).length > 0
                ? g.freeCashId.subCategoryIds
                : g.freeCashId.mainCategoryIds;
            (ids || []).forEach((id) => categoryIds.add(id.toString()));
        }
        const categories = categoryIds.size > 0
            ? await Category.find({ _id: { $in: [...categoryIds] }, vendorId }, { categoryName: 1 })
            : [];
        const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.categoryName]));

        // What each one would take off this cart on its own right now - or,
        // when it can't be used yet, why (isLocked + lockedReason: "Add items
        // worth X more...", "can't be combined with an active discount").
        const lines = cartLines(cart);
        const formatMoney = await resolveMoneyFormatter(countryId, companyMasterData, companySettingsData);
        const grantMap = new Map(grants.map((g) => [g.freeCashId._id.toString(), g]));
        const preview = (freeCashId) => allocateFreeCash({
            freeCashIds: [freeCashId],
            grantMap,
            lines,
            productCategoryMap,
            discounts: cart.discounts,
            totalDiscountAmount: cart.totalDiscountAmount,
            multipleAllowed: true,
            formatMoney
        });

        response.freeCash = grants.map((g) => {
            const fc = g.freeCashId;
            const validOnIds = fc.giveFreeCashTo === 'MAIN_CATEGORY_AND_SUB_CATEGORY' && (fc.subCategoryIds || []).length > 0
                ? fc.subCategoryIds
                : fc.mainCategoryIds;
            const { applied, rejected } = preview(fc._id);
            return {
                freeCashId: fc._id,
                freeCashName: fc.freeCashName,
                remainingAmount: g.remainingAmount,
                validAbove: fc.validAbove,
                maxCashUsagePerOrder: fc.maxCashUsagePerOrder,
                canBeUsedWithOtherDiscounts: fc.canBeUsedWithOtherDiscounts === true,
                endDate: fc.endDate,
                isCategoryRestricted: isCategoryFreeCash(fc),
                validOnCategories: isCategoryFreeCash(fc)
                    ? (validOnIds || []).map((id) => categoryNameById.get(id.toString())).filter(Boolean)
                    : [],
                applicableAmount: applied.length > 0 ? applied[0].amountApplied : 0,
                isLocked: applied.length === 0,
                lockedReason: applied.length === 0 && rejected.length > 0 ? rejected[0].reason : null
            };
        });
        // Usable ones first, then the ones still to unlock.
        response.freeCash.sort((a, b) => Number(a.isLocked) - Number(b.isLocked));

        return common.returnResult(true, 200, 'Eligible Free Cash fetched successfully', response);
    } catch (err) {
        throw err;
    }
};

// Called once, at order-creation commit time (orderService.createOrderFromCart)
// with the cart's final, checkout-revalidated cart.freeCash array - draws
// down each grant's remainingAmount and records a cashUsageHistory entry
// against the real orderId. isStoringRemainingFreeCashAmountAllowed=false
// forfeits any leftover balance immediately instead of carrying it forward.
// order + masters are only for the "Free Cash Used" email (order's currency).
const consumeFreeCashForOrder = async (vendorId, appliedFreeCash, order, userId, companySettingsData, companyMasterData, websiteMasterData) => {
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
            grant.cashUsageHistory.push({ amountUsed, remainingAmount: newRemaining, usedDate: now, orderId: order._id });
            grant.updatedBy = userId;
            await grant.save();

            if (amountUsed > 0) {
                promotionEmailService.notifyFreeCashOrderEvent({
                    vendorId, module: EMAIL_MODULES.FREE_CASH_USED, grant: grant.toObject(), order, amount: amountUsed,
                    companyMasterData, websiteMasterData, companySettingsData, userId
                });
            }
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

        // Worked out in the STORE currency, the one grants are kept in:
        // cart.freeCash[].amountApplied is store currency, while the order's
        // own totals are in the customer's (converted) currency - only their
        // ratio (returnedShare) is taken from the order.
        const now = new Date();

        for (const f of cart.freeCash) {
            // This grant's share: what it took off the order x the returned
            // share of the order x the refund percentage.
            const grantShare = f.amountApplied * returnedShare * (refundPercentage / 100);
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

            promotionEmailService.notifyFreeCashOrderEvent({
                vendorId, module: EMAIL_MODULES.FREE_CASH_REFUNDED, grant: grant.toObject(), order, amount: cappedRefund,
                companyMasterData, websiteMasterData, companySettingsData, userId: adminUserId
            });
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

        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        await revalidateCartItems(cart, locationContext, isBulkPricingOn);
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

                    applyLinePrice(sizeEntry, liveProduct, liveVariant, liveSize, isBulkPricingOn);
                    sizeEntry.isCheckedOut = true;
                    eligibleLineItems.push({
                        productId: productEntry.productId,
                        variantId: variantEntry.variantId,
                        sizeId: sizeEntry.sizeId,
                        productName: productEntry.productName,
                        variantName: variantEntry.variantName,
                        sizeName: sizeEntry.sizeName,
                        sku: sizeEntry.sku,
                        taxIds: liveProduct.taxIds || [],
                        unitPrice: sizeEntry.unitPrice,
                        originalUnitPrice: sizeEntry.originalUnitPrice,
                        isBulkPriceApplied: sizeEntry.isBulkPriceApplied,
                        amount: sizeEntry.unitPrice * sizeEntry.quantity,
                        quantity: sizeEntry.quantity,
                        shippingType: liveSize.shipping?.type || null,
                        shippingValue: liveSize.shipping?.type === 'CUSTOM' ? liveSize.shipping.value : null,
                        mainCategoryId: liveProduct.mainCategory,
                        subCategoryId: liveProduct.subCategory,
                        weight: liveSize.weight || null,
                        // Filled in below, per-item, as each applicable
                        // TaxMaster doc is resolved for this checkout.
                        taxBreakdown: []
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

        const eligibleSubtotal = eligibleLineItems.reduce((sum, i) => sum + i.amount, 0);

        // Tax: the delivery location's taxes (the chosen shipping address when
        // an order is being placed), or the store's own location when it is
        // unknown - never every tax on the product.
        const taxLocation = taxCalculationService.resolveTaxLocationContext(locationContext, companySettingsData);
        await taxCalculationService.applyTaxesToLines(eligibleLineItems, taxLocation);
        const taxSummary = taxCalculationService.summarizeTaxes(eligibleLineItems);
        cart.taxes = taxSummary.taxes;
        cart.totalTaxAmount = taxSummary.totalTaxAmount;

        // Re-work the applied discounts, then Free Cash, against the lines
        // actually being checked out: anything no longer usable, or whose
        // minimum amount/quantity is no longer met, is dropped and every amount
        // is re-worked.
        const checkoutFormatMoney = await resolveMoneyFormatter(locationContext?.countryId || null, companyMasterData, companySettingsData);
        const { droppedDiscounts, droppedFreeCash } = await recalculateCartPromotions(
            vendorId, cart, eligibleLineItems.map((i) => ({ productId: i.productId, productName: i.productName, variantId: i.variantId, sizeId: i.sizeId, quantity: i.quantity, amount: i.amount })),
            companyMasterData, websiteMasterData, companySettingsData, checkoutFormatMoney
        );

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
            eligibleLineItems,
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

/*
|--------------------------------------------------------------------------
| STOCK ADJUSTMENT (order placement / cancellation)
|--------------------------------------------------------------------------
| Product stock was never actually adjusted anywhere - checkoutCart above
| only ever reads size.stock to validate, it never writes it. These bring
| stock in sync with real orders.
|
| Each write is a single-document, per-size conditional $inc - atomic on its
| own regardless of replica-set support, so it doesn't depend on Mongo
| multi-document transactions (see utils/excelRowProcessor.js's
| useTransaction comment - transactions are off by default for this
| deployment). decrementStockForOrder applies these one at a time and, if
| any single item loses the race to insufficient stock, rolls back every
| item it already decremented before failing the whole order.
*/

// A checked-out cart's line items, flattened to exactly what a stock write
// needs. Mirrors checkoutCart's own eligibleLineItems loop, but reads
// isCheckedOut off the (already checked-out) cart instead of re-deriving it,
// since by the time these run checkoutCart has already frozen it.
const checkedOutLineItems = (cart) =>
    cart.products.flatMap((product) =>
        product.variants.flatMap((variant) =>
            variant.sizes
                .filter((size) => size.isCheckedOut)
                .map((size) => ({
                    productId: product.productId,
                    variantId: variant.variantId,
                    sizeId: size.sizeId,
                    quantity: size.quantity
                }))
        )
    );

// delta is negative to decrement (order placement), positive to restore
// (cancellation). requireAvailableStock guards a decrement against a size
// that no longer has enough stock.
//
// The guard has to live in the TOP-LEVEL query filter (via $elemMatch), not
// just the arrayFilters - Product has `timestamps: true`, so an updateOne
// whose arrayFilters match nothing still bumps updatedAt and reports
// modifiedCount: 1, making that an unreliable success signal on its own.
// findOneAndUpdate against an $elemMatch-guarded filter instead returns null
// (no document matched at all) when the size doesn't exist or doesn't have
// enough stock, which is unambiguous regardless of timestamps.
//
// stockChanges (optional array): each deduction is recorded on it for the low
// stock alert - see trackStockDeduction in lowStockAlertService.js.
const adjustSizeStock = async (productId, variantId, sizeId, delta, requireAvailableStock, stockChanges = null) => {
    const sizeElemMatch = { _id: sizeId };
    if (requireAvailableStock) {
        sizeElemMatch.stock = { $gte: -delta };
    }
    const updated = await Product.findOneAndUpdate(
        {
            _id: productId,
            variants: { $elemMatch: { _id: variantId, sizes: { $elemMatch: sizeElemMatch } } }
        },
        { $inc: { 'variants.$[v].sizes.$[s].stock': delta } },
        { arrayFilters: [{ 'v._id': variantId }, { 's._id': sizeId }] }
    );
    lowStockAlertService.trackStockDeduction(stockChanges, updated, variantId, sizeId, delta);
    return updated !== null;
};

// Called once per order, right before it's created, on the cart checkoutCart
// just priced. Returns a failure result (without throwing) if any item lost
// the stock race, so the caller can bail out of order creation before an
// Order document (or the cart deactivation) is ever written.
const decrementStockForOrder = async (cart) => {
    const items = checkedOutLineItems(cart);
    const applied = [];
    // What each deduction did, for the low stock alert the caller sends once
    // the order has actually been saved.
    const stockChanges = [];
    try {
        for (const item of items) {
            const succeeded = await adjustSizeStock(item.productId, item.variantId, item.sizeId, -item.quantity, true, stockChanges);
            if (!succeeded) {
                for (const done of applied) {
                    await adjustSizeStock(done.productId, done.variantId, done.sizeId, done.quantity, false);
                }
                return common.returnResult(
                    false, 409,
                    'One or more items in your cart just went out of stock. Please review your cart and try again.'
                );
            }
            applied.push(item);
        }
        return common.returnResult(true, 200, 'Stock reserved for order', { stockChanges });
    } catch (err) {
        for (const done of applied) {
            await adjustSizeStock(done.productId, done.variantId, done.sizeId, done.quantity, false);
        }
        throw err;
    }
};

// Called on order cancellation (customer cancelOrder or admin advanceOrderStep
// reaching the Rejected step) to give back what decrementStockForOrder took.
// Looks the cart up by id rather than taking a loaded doc, since callers only
// ever have the order (and therefore its cartId) at that point, not the cart
// itself. A missing cart is logged and swallowed rather than thrown - the
// order is already cancelled by the time this runs, so a stock-restore
// hiccup must never fail that back to the caller.
const restoreStockForOrder = async (cartId) => {
    try {
        const cart = await Cart.findById(cartId);
        if (!cart) {
            logger.logInfo(0, 1, 'restoreStockForOrder - cart not found, stock not restored', { cartId });
            return;
        }
        const items = checkedOutLineItems(cart);
        for (const item of items) {
            await adjustSizeStock(item.productId, item.variantId, item.sizeId, item.quantity, false);
        }
    } catch (err) {
        logger.logWarning('Exception in restoreStockForOrder', { cartId, error: err });
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
    listEligibleDiscountsForCart,
    consumeFreeCashForOrder,
    refundFreeCashForReturn,
    checkoutCart,
    decrementStockForOrder,
    restoreStockForOrder,
    // For tests only (tests/discountEligibility.test.js).
    _internal: {
        resolveDiscountEligibility,
        findUncombinableDiscount,
        isDiscountLive,
        recalculateAppliedDiscounts,
        DISCOUNT_LOCK
    }
};
