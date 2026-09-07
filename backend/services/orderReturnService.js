const Order = require('../models/Order');
const OrderReturn = require('../models/OrderReturn');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { RETURN_EXCHANGE_ELIGIBLE_STEP_CODES } = require('../constants/orderStepConstants');

// Flattens the order's cart into its checked-out line items, then keeps
// only the ones whose live Product size still has an active return policy
// window (see common.isWithinPolicyWindow), measured from order.deliveredAt.
const resolveEligibleReturnItems = async (order, cart) => {
    try {
        const lineItems = [];
        for (const p of cart.products) {
            for (const v of p.variants) {
                for (const s of v.sizes) {
                    if (!s.isCheckedOut) continue;
                    lineItems.push({
                        productId: p.productId,
                        variantId: v.variantId,
                        sizeId: s.sizeId,
                        productName: p.productName,
                        variantName: v.variantName,
                        sizeName: s.sizeName,
                        quantity: s.quantity,
                        unitPrice: s.unitPrice
                    });
                }
            }
        }

        const productIds = [...new Set(lineItems.map((item) => item.productId.toString()))];
        const liveProducts = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(liveProducts.map((p) => [p._id.toString(), p]));

        const eligible = [];
        for (const item of lineItems) {
            const liveProduct = productMap.get(item.productId.toString());
            if (!liveProduct) continue;
            const variant = liveProduct.variants.id(item.variantId);
            if (!variant) continue;
            const size = variant.sizes.id(item.sizeId);
            if (!size) continue;
            if (common.isWithinPolicyWindow(size.return, order.deliveredAt)) {
                eligible.push(item);
            }
        }
        return eligible;
    } catch (err) {
        throw err;
    }
};

const createReturnRequest = async (vendorId, userId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isReturnFeatureOn', 'isReturnFeatureOn'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (!RETURN_EXCHANGE_ELIGIBLE_STEP_CODES.includes(order.currentStepCode)) {
            return common.returnResult(false, 400, 'This order is not yet eligible for a return request.');
        }

        const cart = await Cart.findById(order.cartId);
        if (!cart) {
            return common.returnResult(false, 500, 'Could not locate the original order items.');
        }

        const eligibleItems = await resolveEligibleReturnItems(order, cart);
        if (eligibleItems.length === 0) {
            return common.returnResult(false, 400, 'No items on this order are currently eligible for return.');
        }

        const fewItemsReturnOnly = companySettingsData?.fewItemsReturnOnly === true;
        let selectedItems;
        let isWholeOrderReturn;

        if (fewItemsReturnOnly) {
            const { items: requestedItems = [] } = payload;
            if (requestedItems.length === 0) {
                return common.returnResult(false, 400, 'Select at least one item to return.');
            }

            selectedItems = [];
            for (const requested of requestedItems) {
                const match = eligibleItems.find((item) =>
                    item.productId.toString() === requested.productId &&
                    item.variantId.toString() === requested.variantId &&
                    item.sizeId.toString() === requested.sizeId
                );
                if (!match) {
                    return common.returnResult(false, 400, 'One or more selected items are not eligible for return.');
                }
                selectedItems.push({ ...match, reason: requested.reason, reasonDescription: requested.reasonDescription || null });
            }
            isWholeOrderReturn = false;
        } else {
            // Whole-order mode: auto-limited to whichever items are still
            // eligible (confirmed decision) rather than blocking the whole
            // request over one expired item.
            const { reason, reasonDescription } = payload;
            selectedItems = eligibleItems.map((item) => ({ ...item, reason, reasonDescription: reasonDescription || null }));
            isWholeOrderReturn = true;
        }

        const activeExisting = await OrderReturn.find({
            vendorId, orderId, returnStatus: { $nin: ['REJECTED', 'CANCELLED'] }
        });
        const alreadyRequestedKeys = new Set(
            activeExisting.flatMap((r) => r.items.map((item) => `${item.productId}:${item.variantId}:${item.sizeId}`))
        );
        const conflicting = selectedItems.filter((item) => alreadyRequestedKeys.has(`${item.productId}:${item.variantId}:${item.sizeId}`));
        if (conflicting.length > 0) {
            return common.returnResult(false, 409, 'A return request already exists for one or more of these items.');
        }

        const totalRefundAmount = selectedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

        const orderReturn = new OrderReturn({
            vendorId,
            orderId,
            userId,
            isWholeOrderReturn,
            items: selectedItems,
            totalRefundAmount,
            createdBy: userId
        });
        await orderReturn.save();

        logger.logInfo(1, 0, 'Return request created', { vendorId, orderId, returnId: orderReturn._id });
        return common.returnResult(true, 201, 'Return request submitted successfully', { orderReturn });
    } catch (err) {
        throw err;
    }
};

const approveReturn = async (vendorId, adminUserId, returnId, remarks) => {
    try {
        const orderReturn = await OrderReturn.findOne({ _id: returnId, vendorId });
        if (!orderReturn) {
            return common.returnResult(false, 404, 'Return request not found.');
        }
        if (orderReturn.returnStatus !== 'REQUESTED') {
            return common.returnResult(false, 400, 'Only a requested return can be approved.');
        }

        orderReturn.returnStatus = 'APPROVED';
        orderReturn.approvedBy = adminUserId;
        orderReturn.approvedAt = new Date();
        if (remarks) orderReturn.remarks = remarks;
        orderReturn.updatedBy = adminUserId;
        await orderReturn.save();

        logger.logInfo(1, 0, 'Return request approved', { vendorId, returnId });
        return common.returnResult(true, 200, 'Return request approved', { orderReturn });
    } catch (err) {
        throw err;
    }
};

const rejectReturn = async (vendorId, adminUserId, returnId, rejectionReason) => {
    try {
        const orderReturn = await OrderReturn.findOne({ _id: returnId, vendorId });
        if (!orderReturn) {
            return common.returnResult(false, 404, 'Return request not found.');
        }
        if (!['REQUESTED', 'APPROVED'].includes(orderReturn.returnStatus)) {
            return common.returnResult(false, 400, 'This return request can no longer be rejected.');
        }

        orderReturn.returnStatus = 'REJECTED';
        orderReturn.rejectedBy = adminUserId;
        orderReturn.rejectedAt = new Date();
        orderReturn.rejectionReason = rejectionReason;
        orderReturn.updatedBy = adminUserId;
        await orderReturn.save();

        logger.logInfo(1, 0, 'Return request rejected', { vendorId, returnId });
        return common.returnResult(true, 200, 'Return request rejected', { orderReturn });
    } catch (err) {
        throw err;
    }
};

const markReturnPickedUp = async (vendorId, adminUserId, returnId) => {
    try {
        const orderReturn = await OrderReturn.findOne({ _id: returnId, vendorId });
        if (!orderReturn) {
            return common.returnResult(false, 404, 'Return request not found.');
        }
        if (orderReturn.returnStatus !== 'APPROVED') {
            return common.returnResult(false, 400, 'Only an approved return can be marked picked up.');
        }

        orderReturn.returnStatus = 'PICKED_UP';
        orderReturn.pickedUpAt = new Date();
        orderReturn.updatedBy = adminUserId;
        await orderReturn.save();

        logger.logInfo(1, 0, 'Return marked picked up', { vendorId, returnId });
        return common.returnResult(true, 200, 'Return marked as picked up', { orderReturn });
    } catch (err) {
        throw err;
    }
};

const markReturnRefunded = async (vendorId, adminUserId, returnId) => {
    try {
        const orderReturn = await OrderReturn.findOne({ _id: returnId, vendorId });
        if (!orderReturn) {
            return common.returnResult(false, 404, 'Return request not found.');
        }
        if (orderReturn.returnStatus !== 'PICKED_UP') {
            return common.returnResult(false, 400, 'Only a picked-up return can be marked refunded.');
        }

        orderReturn.returnStatus = 'REFUNDED';
        orderReturn.refundedAt = new Date();
        orderReturn.updatedBy = adminUserId;
        await orderReturn.save();

        // Rollup onto the parent Order (see the comment on Order.refundAmount).
        await Order.updateOne(
            { _id: orderReturn.orderId, vendorId },
            { $inc: { refundAmount: orderReturn.totalRefundAmount }, $set: { refundedAt: new Date() } }
        );

        logger.logInfo(1, 0, 'Return marked refunded', { vendorId, returnId });
        return common.returnResult(true, 200, 'Return marked as refunded', { orderReturn });
    } catch (err) {
        throw err;
    }
};

const fetchMyReturns = async (vendorId, userId) => {
    try {
        const orderReturns = await OrderReturn.find({ vendorId, userId, status: { $ne: 'D' } }).sort({ createdAt: -1 });
        return common.returnResult(true, 200, 'Return requests fetched successfully', { orderReturns });
    } catch (err) {
        throw err;
    }
};

const fetchAllReturnsAdmin = async (vendorId) => {
    try {
        const orderReturns = await OrderReturn.find({ vendorId, status: { $ne: 'D' } }).sort({ createdAt: -1 });
        return common.returnResult(true, 200, 'Return requests fetched successfully', { orderReturns });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createReturnRequest,
    approveReturn,
    rejectReturn,
    markReturnPickedUp,
    markReturnRefunded,
    fetchMyReturns,
    fetchAllReturnsAdmin
};
