const Cart = require('../models/Cart');
const Product = require('../models/Product');
const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const WebsiteMaster = require('../models/WebsiteMaster');
const User = require('../models/User');
const common = require('../utils/common');
const logger = require('../utils/logger');
const bulkPricing = require('../utils/bulkPricing');
const redisService = require('./redisService');
const currencyService = require('./currencyService');
const userLocationService = require('./userLocationService');
const redisKeys = require('../utils/redisKeys');
const realtimeService = require('./realtimeService');
const {
    REALTIME_NOTIFICATION_EVENT,
    REALTIME_MODULE_ABANDONED_CART,
    ABANDONED_CART_NOTIFICATION_TYPES,
    ABANDONED_CART_SOURCES,
    ABANDONED_CART_SCAN_INTERVAL_MS,
    DEFAULT_ABANDONED_CART_MINUTES
} = require('../constants/abandonedCartConstants');
const { REALTIME_USER_NOTIFICATION_EVENT, REALTIME_MODULE_CART, CART_NOTIFICATION_TYPES } = require('../constants/realtimeConstants');

const countCartItems = (cart) => (cart.products || []).reduce(
    (sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.sizes.length, 0),
    0
);

// One product/variant/size, as a string key.
const lineKey = (line) => {
    try {
        return `${line.productId}:${line.variantId}:${line.sizeId}`;
    } catch (err) {
        throw err;
    }
};

// What the customer left behind across these carts: one entry per
// product/variant/size, the quantities of a line that is in more than one of
// the carts (logged-in + guest) added together.
const listCartItems = (carts) => {
    try {
        const items = new Map();
        for (const cart of carts) {
            for (const product of (cart.products || [])) {
                for (const variant of product.variants) {
                    for (const size of variant.sizes) {
                        const line = { productId: product.productId, variantId: variant.variantId, sizeId: size.sizeId };
                        const existing = items.get(lineKey(line));
                        if (existing) {
                            existing.quantity += size.quantity;
                            continue;
                        }
                        items.set(lineKey(line), {
                            ...line,
                            productName: product.productName,
                            variantName: variant.variantName,
                            sizeName: size.sizeName,
                            quantity: size.quantity
                        });
                    }
                }
            }
        }
        return Array.from(items.values());
    } catch (err) {
        throw err;
    }
};

// Only a cart that still has something in it is worth showing the admin.
const HAS_PRODUCTS = { 'products.0': { $exists: true } };

/*
|--------------------------------------------------------------------------
| ACTIVITY STAMPING (called from cartService on every change to a cart)
|--------------------------------------------------------------------------
| Stamped for both a logged-in user's cart and a guest cart - Pass 2 also
| tracks abandonment for guest carts (see the scanner below), so a guest
| cart's clock needs to be just as live as a logged-in cart's.
*/

// Restarts the abandonment clock on a cart the customer just changed (added
// a product, changed a quantity, removed an item, applied or removed a
// discount / Free Cash, logged in and had a guest cart merged in), and
// reports back whether it had been flagged abandoned (so the caller can tell
// the admin it was recovered) without saving here itself - the caller already
// saves the cart once, covering every other field it touched in the same request.
const markCartActivity = (cart) => {
    try {
        const wasAbandoned = cart.isAbandoned === true;
        cart.lastProductAddedAt = new Date();
        cart.isAbandoned = false;
        cart.abandonedAt = null;
        return wasAbandoned;
    } catch (err) {
        throw err;
    }
};

// Best-effort push - never throws, so a notification failure can never break
// the cart request that triggered it.
const notifyCartRecovered = (vendorId, cart) => {
    try {
        realtimeService.emitToVendorAdmins(vendorId, REALTIME_NOTIFICATION_EVENT, {
            module: REALTIME_MODULE_ABANDONED_CART,
            type: ABANDONED_CART_NOTIFICATION_TYPES.RECOVERED,
            data: { cartId: cart._id }
        });
    } catch (err) {
        logger.logWarning('Exception in abandonedCartService.notifyCartRecovered', { vendorId, cartId: cart?._id, error: err });
    }
};

// An already-listed customer's row changed without being recovered (another
// cart of theirs was just flagged) - tells the admin page to refresh it.
const notifyAbandonedCartUpdated = (vendorId, cart) => {
    try {
        realtimeService.emitToVendorAdmins(vendorId, REALTIME_NOTIFICATION_EVENT, {
            module: REALTIME_MODULE_ABANDONED_CART,
            type: ABANDONED_CART_NOTIFICATION_TYPES.UPDATED,
            data: { cartId: cart._id }
        });
    } catch (err) {
        logger.logWarning('Exception in abandonedCartService.notifyAbandonedCartUpdated', { vendorId, cartId: cart?._id, error: err });
    }
};

/*
|--------------------------------------------------------------------------
| SCANNER
|--------------------------------------------------------------------------
| Flags active carts that have gone quiet for longer than their vendor's
| configured timeForAbondonedCartReflection, and pushes a live notification
| to that vendor's admin(s). Considers two kinds of candidate:
|   - a logged-in user's cart (userId set) - always considered (Pass 1).
|   - a guest cart carrying a possibleUserId hint - only considered when the
|     vendor has abondonedCartOnlyForLoggedInUsers === false (Pass 2 opt-in).
| A truly anonymous guest cart (no possibleUserId) is never a candidate -
| there's nothing to show the admin for it.
|
| Timing: the scan runs on a fixed interval, and every scan also looks ahead
| one interval - when a cart falls due before the next tick, one extra scan is
| scheduled for that exact moment (scheduleExactScan). So a cart is flagged
| when its configured time is up, not up to an interval later.
|
| Candidates are grouped by the real customer they belong to (userId if
| present, else possibleUserId) so a customer with BOTH a stale logged-in
| cart and a stale guest cart gets ONE combined alert instead of two.
|
| This function is its own entry point (invoked off a timer, not from a
| controller), so its catch block logs directly instead of re-throwing to
| nowhere.
*/
let scanIntervalHandle = null;
let exactScanHandle = null;
let exactScanAt = null;

// Runs one extra scan at `dueAt` unless one is already set for then or sooner.
// Only while the scanner itself is running.
const scheduleExactScan = (dueAt) => {
    try {
        if (!scanIntervalHandle) return;
        const at = new Date(dueAt).getTime();
        if (exactScanHandle && exactScanAt <= at) return;

        clearTimeout(exactScanHandle);
        exactScanAt = at;
        // A few ms late rather than early, so the cart is due when the scan reads it.
        exactScanHandle = setTimeout(async () => {
            exactScanHandle = null;
            exactScanAt = null;
            await scanAndFlagAbandonedCarts();
        }, Math.max(0, at - Date.now()) + 25);
    } catch (err) {
        logger.logWarning('Exception in abandonedCartService.scheduleExactScan', { error: err });
    }
};

const scanAndFlagAbandonedCarts = async () => {
    try {
        const websiteMasterData = await WebsiteMaster.findOne();
        if (!websiteMasterData || websiteMasterData.isAbondonedCartFeatureOn !== true) {
            return;
        }

        const now = new Date();
        // Everything due now, plus what falls due before the next regular scan.
        const horizon = new Date(now.getTime() + ABANDONED_CART_SCAN_INTERVAL_MS);

        const candidates = await Cart.aggregate([
            {
                $match: {
                    status: 'A',
                    // $ne: true - carts saved before this field existed have no value at all.
                    isAbandoned: { $ne: true },
                    ...HAS_PRODUCTS,
                    $or: [
                        { userId: { $ne: null } },
                        { userId: null, possibleUserId: { $ne: null } }
                    ]
                }
            },
            {
                $lookup: {
                    from: CompanyMaster.collection.name,
                    localField: 'vendorId',
                    foreignField: 'vendorId',
                    as: 'companyMaster'
                }
            },
            { $unwind: '$companyMaster' },
            { $match: { 'companyMaster.isAbondonedCartFeatureOn': true } },
            {
                $lookup: {
                    from: CompanySettings.collection.name,
                    localField: 'vendorId',
                    foreignField: 'vendorId',
                    as: 'companySettings'
                }
            },
            { $unwind: { path: '$companySettings', preserveNullAndEmptyArrays: true } },
            {
                $match: {
                    $expr: {
                        $or: [
                            { $ne: ['$userId', null] },
                            { $eq: ['$companySettings.abondonedCartOnlyForLoggedInUsers', false] }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    reflectionMinutes: { $ifNull: ['$companySettings.timeForAbondonedCartReflection', DEFAULT_ABANDONED_CART_MINUTES] },
                    // A cart that got its products without the clock being stamped
                    // (older carts) is measured from when it was last saved.
                    lastActivityAt: { $ifNull: ['$lastProductAddedAt', '$updatedAt'] }
                }
            },
            {
                $addFields: {
                    dueAt: { $add: ['$lastActivityAt', { $multiply: ['$reflectionMinutes', 60000] }] }
                }
            },
            { $match: { $expr: { $lte: ['$dueAt', horizon] } } },
            { $project: { _id: 1, vendorId: 1, userId: 1, possibleUserId: 1, lastProductAddedAt: 1, lastActivityAt: 1, dueAt: 1 } }
        ]);

        const dueNow = candidates.filter((candidate) => candidate.dueAt <= now);
        const upcoming = candidates.filter((candidate) => candidate.dueAt > now);
        if (upcoming.length > 0) {
            scheduleExactScan(new Date(Math.min(...upcoming.map((candidate) => candidate.dueAt.getTime()))));
        }

        if (dueNow.length === 0) {
            return;
        }

        const groups = new Map();
        for (const candidate of dueNow) {
            const ownerId = (candidate.userId || candidate.possibleUserId).toString();
            const key = `${candidate.vendorId.toString()}:${ownerId}`;
            if (!groups.has(key)) {
                groups.set(key, { vendorId: candidate.vendorId, ownerId, candidates: [] });
            }
            groups.get(key).candidates.push(candidate);
        }

        let flaggedCount = 0;

        for (const group of groups.values()) {
            const freshDocs = [];
            for (const candidate of group.candidates) {
                // One atomic claim: only a cart that is still unflagged AND untouched
                // since it was read is flagged, so a customer acting at this very
                // moment (or a second scan running at once) can never be overridden.
                const doc = await Cart.findOneAndUpdate(
                    {
                        _id: candidate._id,
                        status: 'A',
                        isAbandoned: { $ne: true },
                        ...HAS_PRODUCTS,
                        lastProductAddedAt: candidate.lastProductAddedAt || null
                    },
                    { $set: { isAbandoned: true, abandonedAt: now, lastProductAddedAt: candidate.lastActivityAt } },
                    { returnDocument: 'after' }
                );
                if (doc) freshDocs.push(doc);
            }
            if (freshDocs.length === 0) continue;
            flaggedCount += freshDocs.length;

            // If this same customer already has another abandoned cart from
            // an earlier tick, admin was already alerted about them - no
            // second NEW alert, only an UPDATED so the open page folds this
            // cart into that customer's row.
            const alreadyNotified = await Cart.findOne({
                vendorId: group.vendorId,
                status: 'A',
                isAbandoned: true,
                _id: { $nin: freshDocs.map((d) => d._id) },
                $or: [
                    { userId: group.ownerId },
                    { possibleUserId: group.ownerId }
                ]
            });
            if (alreadyNotified) {
                notifyAbandonedCartUpdated(group.vendorId, freshDocs[0]);
                continue;
            }

            const primary = freshDocs.find((d) => d.userId) || freshDocs[0];
            const linkedDocs = freshDocs.filter((d) => d._id.toString() !== primary._id.toString());

            const user = await User.findById(group.ownerId).select('name email phone_no');
            const itemCount = freshDocs.reduce((sum, d) => sum + countCartItems(d), 0);
            const mostRecent = (field) => freshDocs.reduce((latest, d) => (!latest || d[field] > latest ? d[field] : latest), null);

            const source = freshDocs.length > 1
                ? ABANDONED_CART_SOURCES.COMBINED
                : (primary.userId ? ABANDONED_CART_SOURCES.LOGGED_IN : ABANDONED_CART_SOURCES.GUEST_KNOWN);

            realtimeService.emitToVendorAdmins(group.vendorId, REALTIME_NOTIFICATION_EVENT, {
                module: REALTIME_MODULE_ABANDONED_CART,
                type: ABANDONED_CART_NOTIFICATION_TYPES.NEW,
                data: {
                    cartId: primary._id,
                    linkedCartIds: linkedDocs.map((d) => d._id),
                    userId: group.ownerId,
                    userName: user?.name || null,
                    userEmail: user?.email || null,
                    userPhone: user?.phone_no || null,
                    itemCount,
                    source,
                    lastProductAddedAt: mostRecent('lastProductAddedAt'),
                    abandonedAt: mostRecent('abandonedAt')
                }
            });
        }

        if (flaggedCount > 0) {
            logger.logInfo(1, 0, 'Abandoned cart scan flagged carts', { count: flaggedCount });
        }
    } catch (err) {
        logger.logWarning('Exception in abandonedCartService.scanAndFlagAbandonedCarts', { error: err });
    }
};

const startAbandonedCartScanner = () => {
    if (scanIntervalHandle) return;

    scanIntervalHandle = setInterval(async () => {
        const lockKey = redisKeys.abandonedCartScanLock();
        const lockTtlSeconds = Math.floor(ABANDONED_CART_SCAN_INTERVAL_MS / 1000);

        const acquired = await redisService.acquireLock(lockKey, lockTtlSeconds);
        if (!acquired) return;

        await scanAndFlagAbandonedCarts();
    }, ABANDONED_CART_SCAN_INTERVAL_MS);

    // Straight away too, so nothing waits a whole interval after a restart.
    scanAndFlagAbandonedCarts();

    logger.logInfo(1, 0, 'Abandoned cart scanner started', { intervalMs: ABANDONED_CART_SCAN_INTERVAL_MS });
};

const stopAbandonedCartScanner = () => {
    if (scanIntervalHandle) {
        clearInterval(scanIntervalHandle);
        scanIntervalHandle = null;
    }
    clearTimeout(exactScanHandle);
    exactScanHandle = null;
    exactScanAt = null;
};

/*
|--------------------------------------------------------------------------
| ADMIN LISTING
|--------------------------------------------------------------------------
| Mirrors the scanner's grouping: every currently-flagged cart for this
| vendor is grouped by real customer (userId if it's a logged-in cart, else
| possibleUserId), so a customer with more than one abandoned cart at once
| shows as a single combined row instead of duplicates. companySettingsData
| decides whether guest (possibleUserId-only) carts are included at all.
*/

// The Mongo filter for the abandoned carts the admin is shown. `extra` narrows
// it further (one customer's carts).
const abandonedCartsFilter = (vendorId, companySettingsData, extra = {}) => {
    try {
        const includeGuestCarts = companySettingsData?.abondonedCartOnlyForLoggedInUsers === false;
        const base = { vendorId, status: 'A', isAbandoned: true, ...HAS_PRODUCTS, ...extra };
        return includeGuestCarts
            ? { ...base, $or: [{ userId: { $ne: null } }, { userId: null, possibleUserId: { $ne: null } }] }
            : { ...base, userId: { $ne: null } };
    } catch (err) {
        throw err;
    }
};

// The customer's currency and price zone (local / international) for pricing
// their row - the same ones "Place order" charges them in (resolved from their
// saved country, as adminPlaceOrderService.resolveAdminOrderCurrency does).
// Cached per country, since many customers share one. null = the store
// currency isn't configured, so no prices are shown.
const resolveRowCurrency = async (user, cache, companyMasterData, companySettingsData) => {
    try {
        const countryId = userLocationService.extractUserLocation(user).countryId;
        const cacheKey = countryId || '';
        if (!cache.has(cacheKey)) {
            const result = await currencyService.resolveCustomerCurrency({ countryId, companyMasterData, companySettingsData });
            cache.set(cacheKey, result.isSuccess ? result.meta : null);
        }
        return cache.get(cacheKey);
    } catch (err) {
        throw err;
    }
};

// Prices a row's items at what "Place order" would charge today: the
// customer's local or international price, their bulk tier where bulk pricing
// is on, converted into their currency (unit price first, then x quantity -
// the same way an order's lines are converted). An item whose product,
// variant or size is no longer available gets no price and is left out of
// the cart value. An available item with less stock than the quantity is
// flagged isOutOfStock (still priced - it can be ordered when the store lets
// admins order out-of-stock products).
const priceRowItems = (items, productMap, currencyMeta, isBulkPricingOn) => {
    try {
        if (!currencyMeta) {
            return { items, currency: null, cartValue: null, hasUnavailableItems: false, hasOutOfStockItems: false };
        }
        const priceZone = currencyService.toPriceZone(currencyMeta);
        const currency = currencyService.shapeCurrency(currencyMeta.currency);
        const decimals = currency.decimalPlaces;
        const factor = 10 ** decimals;

        let cartValue = 0;
        let hasUnavailableItems = false;
        let hasOutOfStockItems = false;
        const pricedItems = items.map((item) => {
            const product = productMap.get(item.productId.toString());
            const variant = product?.variants.id(item.variantId);
            const size = variant?.status === 'A' ? variant.sizes.id(item.sizeId) : null;
            if (!size || size.status !== 'A') {
                hasUnavailableItems = true;
                return { ...item, isAvailable: false, isOutOfStock: false, stock: null, unitPrice: null, amount: null };
            }
            const { unitPrice: storeUnitPrice } = bulkPricing.resolveUnitPrice(product, variant, size, item.quantity, isBulkPricingOn, priceZone);
            const unitPrice = currencyService.convertAmount(storeUnitPrice, currencyMeta.exchangeRate, decimals);
            const amount = Math.round(unitPrice * item.quantity * factor) / factor;
            cartValue += amount;
            const isOutOfStock = size.stock < item.quantity;
            if (isOutOfStock) hasOutOfStockItems = true;
            return { ...item, isAvailable: true, isOutOfStock, stock: size.stock, unitPrice, amount };
        });

        return { items: pricedItems, currency, cartValue: Math.round(cartValue * factor) / factor, hasUnavailableItems, hasOutOfStockItems };
    } catch (err) {
        throw err;
    }
};

const fetchAbandonedCartsForAdmin = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const carts = await Cart.find(abandonedCartsFilter(vendorId, companySettingsData));

        const groups = new Map();
        for (const cart of carts) {
            const ownerId = (cart.userId || cart.possibleUserId).toString();
            if (!groups.has(ownerId)) groups.set(ownerId, []);
            groups.get(ownerId).push(cart);
        }

        const users = await User.find({ _id: { $in: Array.from(groups.keys()) } }).select('name email phone_no country');
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        // Every product in any listed cart, read once for today's prices.
        const productIds = [...new Set(carts.flatMap((cart) => (cart.products || []).map((p) => p.productId.toString())))];
        const products = await Product.find({ _id: { $in: productIds }, vendorId, status: 'A' });
        const productMap = new Map(products.map((product) => [product._id.toString(), product]));
        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        const currencyCache = new Map();
        // Same switch adminPlaceOrderService.isOutOfStockAllowedForAdmin reads (that
        // file requires this one, so it isn't required here at load time).
        const isOutOfStockOrderAllowed = companySettingsData?.allowOutOfStockProductsAddingForAdmin === true;

        const data = [];
        for (const [ownerId, groupCarts] of groups.entries()) {
            const primary = groupCarts.find((c) => c.userId) || groupCarts[0];
            const linkedCarts = groupCarts.filter((c) => c._id.toString() !== primary._id.toString());
            const user = userMap.get(ownerId);
            const mostRecent = (field) => groupCarts.reduce((latest, c) => (!latest || c[field] > latest ? c[field] : latest), null);
            const currencyMeta = await resolveRowCurrency(user, currencyCache, companyMasterData, companySettingsData);
            const { items, currency, cartValue, hasUnavailableItems, hasOutOfStockItems } = priceRowItems(listCartItems(groupCarts), productMap, currencyMeta, isBulkPricingOn);

            data.push({
                _id: primary._id,
                linkedCartIds: linkedCarts.map((c) => c._id),
                userId: ownerId,
                userName: user?.name || null,
                userEmail: user?.email || null,
                userPhone: user?.phone_no || null,
                itemCount: items.length,
                // What the customer left behind, across every cart folded into this row,
                // each priced at today's price in the customer's currency.
                items,
                currency,
                // Sum of the available items' amounts - before tax, shipping and discounts.
                cartValue,
                hasUnavailableItems,
                // Items with less stock than the quantity, and whether Place Order may still order them.
                hasOutOfStockItems,
                isOutOfStockOrderAllowed,
                source: groupCarts.length > 1
                    ? ABANDONED_CART_SOURCES.COMBINED
                    : (primary.userId ? ABANDONED_CART_SOURCES.LOGGED_IN : ABANDONED_CART_SOURCES.GUEST_KNOWN),
                lastProductAddedAt: mostRecent('lastProductAddedAt'),
                abandonedAt: mostRecent('abandonedAt')
            });
        }
        data.sort((a, b) => new Date(b.abandonedAt) - new Date(a.abandonedAt));

        return common.returnResult(true, 200, 'Abandoned carts fetched successfully', { data });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| PLACING THE ORDER FOR AN ABANDONED CART (admin)
|--------------------------------------------------------------------------
| The admin can turn a customer's abandoned cart into an order - straight
| from the list (placeOrderFromAbandonedCart) or through the Place Order page
| with the cart's products filled in. Either way it is an ordinary admin
| "Place Order" (adminPlaceOrderService), and once it is placed the
| customer's cart(s) are emptied so the same products can't be ordered twice.
*/

// Empties the customer's abandoned cart(s) an order was just placed from:
// products, discounts and Free Cash go, the abandoned flag is cleared, and the
// admin page is told the row is gone. Only ever touches this vendor's carts
// that belong to this customer. Best-effort: the order is already placed.
const emptyCartsAfterAdminOrder = async (vendorId, userId, cartIds, adminUserId) => {
    try {
        if (!userId || !Array.isArray(cartIds) || cartIds.length === 0) return;

        const carts = await Cart.find({
            _id: { $in: cartIds },
            vendorId,
            status: 'A',
            $or: [{ userId }, { userId: null, possibleUserId: userId }]
        });

        for (const cart of carts) {
            cart.products = [];
            cart.discounts = [];
            cart.totalDiscountAmount = 0;
            cart.freeCash = [];
            cart.totalFreeCashAmount = 0;
            cart.isAbandoned = false;
            cart.abandonedAt = null;
            cart.updatedBy = adminUserId;
            await cart.save();

            const ownerKey = cart.userId ? `user:${cart.userId}` : `guest:${cart.guestId}`;
            await redisService.del(redisKeys.cartTotal(vendorId, ownerKey));
            notifyCartRecovered(vendorId, cart);
        }

        // The customer's own open storefront (every tab / device they are
        // logged in on) re-reads the cart, so it empties without a reload.
        if (carts.length > 0) {
            realtimeService.emitToUser(vendorId, userId, REALTIME_USER_NOTIFICATION_EVENT, {
                module: REALTIME_MODULE_CART,
                type: CART_NOTIFICATION_TYPES.EMPTIED,
                data: null
            });
        }
    } catch (err) {
        logger.logWarning('Exception in abandonedCartService.emptyCartsAfterAdminOrder', { vendorId, userId, error: err });
    }
};

// One click from the Abandoned Carts list: orders everything in this
// customer's abandoned cart(s) for them, at today's prices (their bulk
// pricing tier price where the store has bulk pricing on, as in their cart),
// with no shipping price or discount - those can be set on the order
// afterwards. cartId is the row's primary cart.
//
// The delivery address is required and is exactly one of: one of the
// customer's saved addresses (address.addressId - the order is then taxed
// there), or one typed by the admin (address.addressText - kept on the order
// only, never added to the customer's address book).
const placeOrderFromAbandonedCart = async (vendorId, adminUserId, cartId, websiteMasterData, companyMasterData, companySettingsData, address = {}) => {
    try {
        // Required here, not at the top: adminPlaceOrderService itself requires this file.
        const adminPlaceOrderService = require('./adminPlaceOrderService');

        const addressId = address?.addressId || null;
        const addressText = typeof address?.addressText === 'string' ? address.addressText.trim() : '';
        if (!addressId && !addressText) {
            return common.returnResult(false, 400, 'Choose a saved address or enter the delivery address.');
        }
        if (addressId && addressText) {
            return common.returnResult(false, 400, 'Provide either a saved address or a typed address, not both.');
        }

        const primary = await Cart.findOne(abandonedCartsFilter(vendorId, companySettingsData, { _id: cartId }));
        if (!primary) {
            return common.returnResult(false, 404, 'This cart is no longer abandoned. The customer may have come back to it.');
        }

        const ownerId = primary.userId || primary.possibleUserId;
        const carts = await Cart.find(abandonedCartsFilter(vendorId, companySettingsData, {
            $and: [{ $or: [{ userId: ownerId }, { userId: null, possibleUserId: ownerId }] }]
        }));
        const items = listCartItems(carts).map((item) => ({
            productId: item.productId, variantId: item.variantId, sizeId: item.sizeId, quantity: item.quantity
        }));

        const applyBulkPricing = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        const result = await adminPlaceOrderService.placeOrderOnBehalfOfUser(
            vendorId, adminUserId, websiteMasterData, companyMasterData, companySettingsData,
            {
                userId: ownerId,
                isWalkInCustomer: false,
                items,
                applyBulkPricing,
                shippingAmount: 0,
                discountAmount: 0,
                isTaxManual: false,
                ...(addressId ? { addressId } : { addressText }),
                abandonedCartIds: carts.map((cart) => cart._id)
            }
        );
        if (!result.isSuccess) {
            return common.returnResult(false, result.statusCode, result.message);
        }

        logger.logInfo(1, 0, 'Order placed from an abandoned cart', { vendorId, adminUserId, userId: ownerId, orderId: result.meta.order._id });
        return common.returnResult(true, 201, 'Order placed successfully', { order: result.meta.order });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    markCartActivity,
    notifyCartRecovered,
    scanAndFlagAbandonedCarts,
    startAbandonedCartScanner,
    stopAbandonedCartScanner,
    fetchAbandonedCartsForAdmin,
    emptyCartsAfterAdminOrder,
    placeOrderFromAbandonedCart
};
