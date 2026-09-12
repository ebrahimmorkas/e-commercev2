const Cart = require('../models/Cart');
const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const WebsiteMaster = require('../models/WebsiteMaster');
const User = require('../models/User');
const common = require('../utils/common');
const logger = require('../utils/logger');
const redisService = require('./redisService');
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

const countCartItems = (cart) => (cart.products || []).reduce(
    (sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.sizes.length, 0),
    0
);

/*
|--------------------------------------------------------------------------
| ACTIVITY STAMPING (called from cartService.addProductToCart)
|--------------------------------------------------------------------------
| Stamped for both a logged-in user's cart and a guest cart - Pass 2 also
| tracks abandonment for guest carts (see the scanner below), so a guest
| cart's clock needs to be just as live as a logged-in cart's.
*/

// Stamps/resets the activity clock on a cart that was just added to, and
// reports back whether it had previously been flagged abandoned (so the
// caller can notify the admin it was recovered) without saving here itself -
// the caller (cartService.addProductToCart) already saves the cart once,
// covering every other field it touched in the same request.
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
// the add-to-cart flow that triggered it.
const notifyCartRecovered = (vendorId, cart) => {
    try {
        realtimeService.emitToVendorAdmins(vendorId, REALTIME_NOTIFICATION_EVENT, {
            module: REALTIME_MODULE_ABANDONED_CART,
            type: ABANDONED_CART_NOTIFICATION_TYPES.RECOVERED,
            data: { cartId: cart._id }
        });
    } catch (err) {
        logger.logException('Exception in abandonedCartService.notifyCartRecovered', { vendorId, cartId: cart?._id, error: err });
    }
};

/*
|--------------------------------------------------------------------------
| SCANNER
|--------------------------------------------------------------------------
| Periodically flags active carts that have gone quiet for longer than their
| vendor's configured timeForAbondonedCartReflection, and pushes a live
| notification to that vendor's admin(s). Considers two kinds of candidate:
|   - a logged-in user's cart (userId set) - always considered (Pass 1).
|   - a guest cart carrying a possibleUserId hint - only considered when the
|     vendor has abondonedCartOnlyForLoggedInUsers === false (Pass 2 opt-in).
| A truly anonymous guest cart (no possibleUserId) is never a candidate -
| there's nothing to show the admin for it.
|
| Candidates are grouped by the real customer they belong to (userId if
| present, else possibleUserId) so a customer with BOTH a stale logged-in
| cart and a stale guest cart gets ONE combined alert instead of two.
|
| This function is its own entry point (invoked off a setInterval, not from
| a controller), so its catch block logs directly instead of re-throwing to
| nowhere.
*/
const scanAndFlagAbandonedCarts = async () => {
    try {
        const websiteMasterData = await WebsiteMaster.findOne();
        if (!websiteMasterData || websiteMasterData.isAbondonedCartFeatureOn !== true) {
            return;
        }

        const now = new Date();

        const candidates = await Cart.aggregate([
            {
                $match: {
                    status: 'A',
                    isAbandoned: false,
                    lastProductAddedAt: { $ne: null },
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
                    reflectionMinutes: { $ifNull: ['$companySettings.timeForAbondonedCartReflection', DEFAULT_ABANDONED_CART_MINUTES] }
                }
            },
            {
                $addFields: {
                    cutoff: { $subtract: [now, { $multiply: ['$reflectionMinutes', 60000] }] }
                }
            },
            { $match: { $expr: { $lte: ['$lastProductAddedAt', '$cutoff'] } } },
            { $project: { _id: 1, vendorId: 1, userId: 1, possibleUserId: 1 } }
        ]);

        if (candidates.length === 0) {
            return;
        }

        const groups = new Map();
        for (const candidate of candidates) {
            const ownerId = (candidate.userId || candidate.possibleUserId).toString();
            const key = `${candidate.vendorId.toString()}:${ownerId}`;
            if (!groups.has(key)) {
                groups.set(key, { vendorId: candidate.vendorId, ownerId, cartIds: [] });
            }
            groups.get(key).cartIds.push(candidate._id);
        }

        let flaggedCount = 0;

        for (const group of groups.values()) {
            const freshDocs = [];
            for (const cartId of group.cartIds) {
                const doc = await Cart.findOne({ _id: cartId, status: 'A', isAbandoned: false });
                if (!doc) continue;

                doc.isAbandoned = true;
                doc.abandonedAt = now;
                await doc.save();
                freshDocs.push(doc);
            }
            if (freshDocs.length === 0) continue;
            flaggedCount += freshDocs.length;

            // If this same customer already has another abandoned cart from
            // an earlier tick, admin was already alerted about them - flag
            // this one silently rather than pushing a second notification.
            // The admin listing still folds every abandoned cart for this
            // customer into one row next time it's fetched.
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
            if (alreadyNotified) continue;

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
        logger.logException('Exception in abandonedCartService.scanAndFlagAbandonedCarts', { error: err });
    }
};

let scanIntervalHandle = null;

const startAbandonedCartScanner = () => {
    if (scanIntervalHandle) return;

    scanIntervalHandle = setInterval(async () => {
        const lockKey = redisKeys.abandonedCartScanLock();
        const lockTtlSeconds = Math.floor(ABANDONED_CART_SCAN_INTERVAL_MS / 1000);

        const acquired = await redisService.acquireLock(lockKey, lockTtlSeconds);
        if (!acquired) return;

        await scanAndFlagAbandonedCarts();
    }, ABANDONED_CART_SCAN_INTERVAL_MS);

    logger.logInfo(1, 0, 'Abandoned cart scanner started', { intervalMs: ABANDONED_CART_SCAN_INTERVAL_MS });
};

const stopAbandonedCartScanner = () => {
    if (scanIntervalHandle) {
        clearInterval(scanIntervalHandle);
        scanIntervalHandle = null;
    }
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

const fetchAbandonedCartsForAdmin = async (vendorId, companySettingsData) => {
    try {
        const includeGuestCarts = companySettingsData?.abondonedCartOnlyForLoggedInUsers === false;

        const filter = includeGuestCarts
            ? {
                vendorId,
                status: 'A',
                isAbandoned: true,
                $or: [
                    { userId: { $ne: null } },
                    { userId: null, possibleUserId: { $ne: null } }
                ]
            }
            : { vendorId, status: 'A', isAbandoned: true, userId: { $ne: null } };

        const carts = await Cart.find(filter);

        const groups = new Map();
        for (const cart of carts) {
            const ownerId = (cart.userId || cart.possibleUserId).toString();
            if (!groups.has(ownerId)) groups.set(ownerId, []);
            groups.get(ownerId).push(cart);
        }

        const users = await User.find({ _id: { $in: Array.from(groups.keys()) } }).select('name email phone_no');
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const data = Array.from(groups.entries()).map(([ownerId, groupCarts]) => {
            const primary = groupCarts.find((c) => c.userId) || groupCarts[0];
            const linkedCarts = groupCarts.filter((c) => c._id.toString() !== primary._id.toString());
            const user = userMap.get(ownerId);
            const itemCount = groupCarts.reduce((sum, c) => sum + countCartItems(c), 0);
            const mostRecent = (field) => groupCarts.reduce((latest, c) => (!latest || c[field] > latest ? c[field] : latest), null);

            return {
                _id: primary._id,
                linkedCartIds: linkedCarts.map((c) => c._id),
                userId: ownerId,
                userName: user?.name || null,
                userEmail: user?.email || null,
                userPhone: user?.phone_no || null,
                itemCount,
                source: groupCarts.length > 1
                    ? ABANDONED_CART_SOURCES.COMBINED
                    : (primary.userId ? ABANDONED_CART_SOURCES.LOGGED_IN : ABANDONED_CART_SOURCES.GUEST_KNOWN),
                lastProductAddedAt: mostRecent('lastProductAddedAt'),
                abandonedAt: mostRecent('abandonedAt')
            };
        }).sort((a, b) => new Date(b.abandonedAt) - new Date(a.abandonedAt));

        return common.returnResult(true, 200, 'Abandoned carts fetched successfully', { data });
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
    fetchAbandonedCartsForAdmin
};
