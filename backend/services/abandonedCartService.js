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
    ABANDONED_CART_SCAN_INTERVAL_MS,
    DEFAULT_ABANDONED_CART_MINUTES
} = require('../constants/abandonedCartConstants');

/*
|--------------------------------------------------------------------------
| ACTIVITY STAMPING (called from cartService.addProductToCart)
|--------------------------------------------------------------------------
| Pass 1 only tracks logged-in users' carts (cartOwner.type === 'user') -
| guest carts (Pass 2) are simply never stamped, so they can never match the
| scanner's `userId: { $ne: null }` filter below.
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
| Periodically flags active, logged-in-user carts that have gone quiet for
| longer than their vendor's configured timeForAbondonedCartReflection, and
| pushes a live notification to that vendor's admin(s). This function is its
| own entry point (invoked off a setInterval, not from a controller), so its
| catch block logs directly instead of re-throwing to nowhere.
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
                    userId: { $ne: null },
                    lastProductAddedAt: { $ne: null }
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
            { $project: { _id: 1 } }
        ]);

        if (candidates.length === 0) {
            return;
        }

        for (const candidate of candidates) {
            const cart = await Cart.findOne({ _id: candidate._id, status: 'A', isAbandoned: false });
            if (!cart) continue;

            cart.isAbandoned = true;
            cart.abandonedAt = now;
            await cart.save();

            const user = await User.findById(cart.userId).select('name email phone_no');
            const itemCount = cart.products.reduce(
                (sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.sizes.length, 0),
                0
            );

            realtimeService.emitToVendorAdmins(cart.vendorId, REALTIME_NOTIFICATION_EVENT, {
                module: REALTIME_MODULE_ABANDONED_CART,
                type: ABANDONED_CART_NOTIFICATION_TYPES.NEW,
                data: {
                    cartId: cart._id,
                    userId: cart.userId,
                    userName: user?.name || null,
                    userEmail: user?.email || null,
                    userPhone: user?.phone_no || null,
                    itemCount,
                    lastProductAddedAt: cart.lastProductAddedAt,
                    abandonedAt: cart.abandonedAt
                }
            });
        }

        logger.logInfo(1, 0, 'Abandoned cart scan flagged carts', { count: candidates.length });
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
*/

const fetchAbandonedCartsForAdmin = async (vendorId) => {
    try {
        const carts = await Cart.find({ vendorId, status: 'A', isAbandoned: true })
            .sort({ abandonedAt: -1 })
            .populate('userId', 'name email phone_no');

        const data = carts.map((cart) => ({
            _id: cart._id,
            userId: cart.userId?._id || null,
            userName: cart.userId?.name || null,
            userEmail: cart.userId?.email || null,
            userPhone: cart.userId?.phone_no || null,
            products: cart.products,
            itemCount: cart.products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.sizes.length, 0), 0),
            lastProductAddedAt: cart.lastProductAddedAt,
            abandonedAt: cart.abandonedAt
        }));

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
