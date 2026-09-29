const Discount = require('../models/Discount');
const DiscountUsage = require('../models/DiscountUsage');
const OrderReturn = require('../models/OrderReturn');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| DISCOUNT USAGE (order placement / cancellation / return)
|--------------------------------------------------------------------------
| The cart only checks a discount's usage limits; the limits that two
| customers could race for are claimed here, atomically, while the order is
| being placed:
|   - numberOfUsersCanUseDiscount : the customer is added to usedByUserIds
|     only while fewer than N customers are in it.
|   - firstOrderOnly               : only one order can hold the discount.
| Nothing is given back when an order is cancelled, EXCEPT a firstOrderOnly
| discount, which is released for everyone but the customer who cancelled
| (or fully returned) that order.
*/

// Claims the limited discounts on this cart for the order being placed.
// Returns { isSuccess, message, claims } - claims is what
// releaseDiscountClaims undoes if the order then fails.
const claimDiscountsForOrder = async (vendorId, appliedDiscounts, userId, orderId) => {
    try {
        const claims = [];
        if (!Array.isArray(appliedDiscounts) || appliedDiscounts.length === 0) {
            return { isSuccess: true, claims };
        }

        const discounts = await Discount.find({ _id: { $in: appliedDiscounts.map((d) => d.discountId) }, vendorId });

        for (const discount of discounts) {
            if (discount.firstOrderOnly) {
                const claimed = await Discount.updateOne(
                    { _id: discount._id, vendorId, isDiscountUsedForFirstTime: { $ne: true }, firstOrderExcludedUserIds: { $ne: userId } },
                    { $set: { isDiscountUsedForFirstTime: true, firstOrderClaimedBy: userId, firstOrderClaimedOrderId: orderId } }
                );
                if (claimed.modifiedCount === 0) {
                    await releaseDiscountClaims(vendorId, claims, userId);
                    return { isSuccess: false, message: `The discount "${discount.name}" has just been used by another customer. Please review your cart.` };
                }
                claims.push({ discountId: discount._id, firstOrder: true, addedUser: false });
            }

            const limit = discount.numberOfUsersCanUseDiscount;
            if (limit !== null && limit !== undefined) {
                // Already one of the N customers -> nothing to claim.
                const added = await Discount.updateOne(
                    {
                        _id: discount._id,
                        vendorId,
                        usedByUserIds: { $ne: userId },
                        $expr: { $lt: [{ $size: { $ifNull: ['$usedByUserIds', []] } }, limit] }
                    },
                    { $addToSet: { usedByUserIds: userId } }
                );
                if (added.modifiedCount === 0) {
                    const alreadyCounted = await Discount.exists({ _id: discount._id, vendorId, usedByUserIds: userId });
                    if (!alreadyCounted) {
                        await releaseDiscountClaims(vendorId, claims, userId);
                        return { isSuccess: false, message: `The discount "${discount.name}" has reached its limit of customers. Please review your cart.` };
                    }
                } else {
                    const existing = claims.find((c) => c.discountId.toString() === discount._id.toString());
                    if (existing) existing.addedUser = true;
                    else claims.push({ discountId: discount._id, firstOrder: false, addedUser: true });
                }
            }
        }

        return { isSuccess: true, claims };
    } catch (err) {
        throw err;
    }
};

// Undoes claimDiscountsForOrder when the order did not go through.
const releaseDiscountClaims = async (vendorId, claims, userId) => {
    try {
        for (const claim of claims || []) {
            if (claim.firstOrder) {
                await Discount.updateOne(
                    { _id: claim.discountId, vendorId, firstOrderClaimedBy: userId },
                    { $set: { isDiscountUsedForFirstTime: false, firstOrderClaimedBy: null, firstOrderClaimedOrderId: null } }
                );
            }
            if (claim.addedUser) {
                await Discount.updateOne({ _id: claim.discountId, vendorId }, { $pull: { usedByUserIds: userId } });
            }
        }
    } catch (err) {
        throw err;
    }
};

// Called once the order is saved: one DiscountUsage per applied discount,
// and the discount's own running totals.
const recordDiscountUsageForOrder = async (vendorId, appliedDiscounts, order, userId) => {
    try {
        if (!Array.isArray(appliedDiscounts) || appliedDiscounts.length === 0) return;

        await DiscountUsage.insertMany(appliedDiscounts.map((d) => ({
            vendorId,
            discountId: d.discountId,
            userId,
            orderId: order._id,
            discountName: d.discountName,
            discountAmount: d.discountAmount,
            usedDate: new Date(),
            createdBy: userId
        })));

        for (const d of appliedDiscounts) {
            await Discount.updateOne(
                { _id: d.discountId, vendorId },
                { $inc: { totalUsageCount: 1, totalDiscountGiven: d.discountAmount } }
            );
        }
    } catch (err) {
        throw err;
    }
};

// How many times this customer has used each of these discounts - for the
// isDiscountReusable / discountReusableNumber check. Map of discountId -> count.
const countUsageByUser = async (vendorId, userId, discountIds) => {
    try {
        if (!userId || !discountIds || discountIds.length === 0) return new Map();
        // aggregate() does not cast like find() does.
        const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
        const rows = await DiscountUsage.aggregate([
            { $match: { vendorId: toObjectId(vendorId), userId: toObjectId(userId), discountId: { $in: discountIds.map(toObjectId) }, status: 'A' } },
            { $group: { _id: '$discountId', count: { $sum: 1 } } }
        ]);
        return new Map(rows.map((r) => [r._id.toString(), r.count]));
    } catch (err) {
        throw err;
    }
};

// Frees every firstOrderOnly discount this order was holding, so the next
// customer can claim it (still only within its dates - the cart checks those).
// excludeUserId = the customer who cancelled/returned it; they can't claim it again.
const releaseFirstOrderDiscounts = async (vendorId, orderId, excludeUserId = null) => {
    try {
        const update = { $set: { isDiscountUsedForFirstTime: false, firstOrderClaimedBy: null, firstOrderClaimedOrderId: null } };
        if (excludeUserId) update.$addToSet = { firstOrderExcludedUserIds: excludeUserId };

        const result = await Discount.updateMany({ vendorId, firstOrderClaimedOrderId: orderId }, update);
        if (result.modifiedCount > 0) {
            logger.logInfo(1, 0, 'First-order discount released', { vendorId, orderId, count: result.modifiedCount });
        }
    } catch (err) {
        throw err;
    }
};

// After a return is refunded: frees the order's firstOrderOnly discount only
// once EVERY item of the order has been returned and refunded (never on a
// partial return).
const releaseFirstOrderDiscountsIfFullyReturned = async (vendorId, order) => {
    try {
        const held = await Discount.exists({ vendorId, firstOrderClaimedOrderId: order._id });
        if (!held) return;

        const refundedReturns = await OrderReturn.find({ vendorId, orderId: order._id, returnStatus: 'REFUNDED' });
        const returnedBySize = new Map();
        for (const orderReturn of refundedReturns) {
            for (const item of orderReturn.items || []) {
                const key = item.sizeId.toString();
                returnedBySize.set(key, (returnedBySize.get(key) || 0) + item.quantity);
            }
        }

        const fullyReturned = (order.items || []).length > 0
            && order.items.every((item) => (returnedBySize.get(item.sizeId.toString()) || 0) >= item.quantity);
        if (fullyReturned) {
            await releaseFirstOrderDiscounts(vendorId, order._id, order.userId);
        }
    } catch (err) {
        throw err;
    }
};

module.exports = {
    claimDiscountsForOrder,
    releaseDiscountClaims,
    recordDiscountUsageForOrder,
    countUsageByUser,
    releaseFirstOrderDiscounts,
    releaseFirstOrderDiscountsIfFullyReturned
};
