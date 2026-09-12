const Order = require('../models/Order');
const OrderExchange = require('../models/OrderExchange');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { RETURN_EXCHANGE_ELIGIBLE_STEP_CODES } = require('../constants/orderStepConstants');

// Mirrors resolveEligibleReturnItems in orderReturnService.js, checking the
// size's `exchange` policy instead of `return`.
const resolveEligibleExchangeItems = async (order, cart) => {
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
            if (common.isWithinPolicyWindow(size.exchange, order.deliveredAt)) {
                eligible.push(item);
            }
        }
        return eligible;
    } catch (err) {
        throw err;
    }
};

// Resolves the live product/variant/size the customer wants instead.
const resolveRequestedReplacement = async (vendorId, productId, variantId, sizeId) => {
    try {
        const product = await Product.findOne({ _id: productId, vendorId, status: 'A' });
        if (!product) return { error: 'Requested replacement product not found.' };

        const variant = product.variants.id(variantId);
        if (!variant || variant.status !== 'A') return { error: 'Requested replacement variant not found.' };

        const size = variant.sizes.id(sizeId);
        if (!size || size.status !== 'A') return { error: 'Requested replacement size not found.' };

        return {
            productId: product._id,
            variantId: variant._id,
            sizeId: size._id,
            productName: product.name,
            variantName: variant.displayName || variant.color || 'Default',
            sizeName: size.sizeName,
            unitPrice: size.price
        };
    } catch (err) {
        throw err;
    }
};

const createExchangeRequest = async (vendorId, userId, orderId, payload, companyMasterData, websiteMasterData, companySettingsData) => {
    try {
        const featureCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isExchangeFeatureOn', 'isExchangeFeatureOn'
        );
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: { $ne: 'D' } });
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        if (!RETURN_EXCHANGE_ELIGIBLE_STEP_CODES.includes(order.currentStepCode)) {
            return common.returnResult(false, 400, 'This order is not yet eligible for an exchange request.');
        }

        const cart = await Cart.findById(order.cartId);
        if (!cart) {
            return common.returnResult(false, 500, 'Could not locate the original order items.');
        }

        const eligibleItems = await resolveEligibleExchangeItems(order, cart);
        if (eligibleItems.length === 0) {
            return common.returnResult(false, 400, 'No items on this order are currently eligible for exchange.');
        }

        const { items: requestedItems = [] } = payload;
        if (requestedItems.length === 0) {
            return common.returnResult(false, 400, 'Select at least one item to exchange.');
        }

        // Unlike return, exchange always needs an explicit requested
        // replacement per item - there's no "auto" replacement. The
        // fewItemsExchangeOnly toggle only controls whether ALL currently
        // eligible items must be included in one request, or a subset is
        // allowed.
        const fewItemsExchangeOnly = companySettingsData?.fewItemsExchangeOnly === true;
        if (!fewItemsExchangeOnly && requestedItems.length < eligibleItems.length) {
            return common.returnResult(false, 400, 'This store requires exchanging all eligible items together in one request.');
        }

        const selectedItems = [];
        for (const requested of requestedItems) {
            const match = eligibleItems.find((item) =>
                item.productId.toString() === requested.productId &&
                item.variantId.toString() === requested.variantId &&
                item.sizeId.toString() === requested.sizeId
            );
            if (!match) {
                return common.returnResult(false, 400, 'One or more selected items are not eligible for exchange.');
            }

            const replacement = await resolveRequestedReplacement(
                vendorId, requested.requestedProductId, requested.requestedVariantId, requested.requestedSizeId
            );
            if (replacement.error) {
                return common.returnResult(false, 400, replacement.error);
            }

            selectedItems.push({
                ...match,
                requestedProductId: replacement.productId,
                requestedVariantId: replacement.variantId,
                requestedSizeId: replacement.sizeId,
                requestedProductName: replacement.productName,
                requestedVariantName: replacement.variantName,
                requestedSizeName: replacement.sizeName,
                requestedUnitPrice: replacement.unitPrice,
                priceDifference: replacement.unitPrice - match.unitPrice,
                reason: requested.reason,
                reasonDescription: requested.reasonDescription || null
            });
        }

        const activeExisting = await OrderExchange.find({
            vendorId, orderId, exchangeStatus: { $nin: ['REJECTED', 'CANCELLED'] }
        });
        const alreadyRequestedKeys = new Set(
            activeExisting.flatMap((r) => r.items.map((item) => `${item.productId}:${item.variantId}:${item.sizeId}`))
        );
        const conflicting = selectedItems.filter((item) => alreadyRequestedKeys.has(`${item.productId}:${item.variantId}:${item.sizeId}`));
        if (conflicting.length > 0) {
            return common.returnResult(false, 409, 'An exchange request already exists for one or more of these items.');
        }

        const totalPriceDifference = selectedItems.reduce((sum, item) => sum + item.priceDifference, 0);

        const orderExchange = new OrderExchange({
            vendorId,
            orderId,
            userId,
            isWholeOrderExchange: !fewItemsExchangeOnly,
            items: selectedItems,
            totalPriceDifference,
            createdBy: userId
        });
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange request created', { vendorId, orderId, exchangeId: orderExchange._id });
        return common.returnResult(true, 201, 'Exchange request submitted successfully', { orderExchange });
    } catch (err) {
        throw err;
    }
};

const approveExchange = async (vendorId, adminUserId, exchangeId, remarks) => {
    try {
        const orderExchange = await OrderExchange.findOne({ _id: exchangeId, vendorId });
        if (!orderExchange) {
            return common.returnResult(false, 404, 'Exchange request not found.');
        }
        if (orderExchange.exchangeStatus !== 'REQUESTED') {
            return common.returnResult(false, 400, 'Only a requested exchange can be approved.');
        }

        orderExchange.exchangeStatus = 'APPROVED';
        orderExchange.approvedBy = adminUserId;
        orderExchange.approvedAt = new Date();
        if (remarks) orderExchange.remarks = remarks;
        orderExchange.updatedBy = adminUserId;
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange request approved', { vendorId, exchangeId });
        return common.returnResult(true, 200, 'Exchange request approved', { orderExchange });
    } catch (err) {
        throw err;
    }
};

const rejectExchange = async (vendorId, adminUserId, exchangeId, rejectionReason) => {
    try {
        const orderExchange = await OrderExchange.findOne({ _id: exchangeId, vendorId });
        if (!orderExchange) {
            return common.returnResult(false, 404, 'Exchange request not found.');
        }
        if (!['REQUESTED', 'APPROVED'].includes(orderExchange.exchangeStatus)) {
            return common.returnResult(false, 400, 'This exchange request can no longer be rejected.');
        }

        orderExchange.exchangeStatus = 'REJECTED';
        orderExchange.rejectedBy = adminUserId;
        orderExchange.rejectedAt = new Date();
        orderExchange.rejectionReason = rejectionReason;
        orderExchange.updatedBy = adminUserId;
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange request rejected', { vendorId, exchangeId });
        return common.returnResult(true, 200, 'Exchange request rejected', { orderExchange });
    } catch (err) {
        throw err;
    }
};

const markExchangePickedUp = async (vendorId, adminUserId, exchangeId) => {
    try {
        const orderExchange = await OrderExchange.findOne({ _id: exchangeId, vendorId });
        if (!orderExchange) {
            return common.returnResult(false, 404, 'Exchange request not found.');
        }
        if (orderExchange.exchangeStatus !== 'APPROVED') {
            return common.returnResult(false, 400, 'Only an approved exchange can be marked picked up.');
        }

        orderExchange.exchangeStatus = 'PICKED_UP';
        orderExchange.pickedUpAt = new Date();
        orderExchange.updatedBy = adminUserId;
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange marked picked up', { vendorId, exchangeId });
        return common.returnResult(true, 200, 'Exchange marked as picked up', { orderExchange });
    } catch (err) {
        throw err;
    }
};

const markExchangeReplacementShipped = async (vendorId, adminUserId, exchangeId) => {
    try {
        const orderExchange = await OrderExchange.findOne({ _id: exchangeId, vendorId });
        if (!orderExchange) {
            return common.returnResult(false, 404, 'Exchange request not found.');
        }
        if (orderExchange.exchangeStatus !== 'PICKED_UP') {
            return common.returnResult(false, 400, 'Only a picked-up exchange can have its replacement shipped.');
        }

        orderExchange.exchangeStatus = 'REPLACEMENT_SHIPPED';
        orderExchange.replacementShippedAt = new Date();
        orderExchange.updatedBy = adminUserId;
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange replacement shipped', { vendorId, exchangeId });
        return common.returnResult(true, 200, 'Replacement marked as shipped', { orderExchange });
    } catch (err) {
        throw err;
    }
};

// NOTE: deliberately does NOT refund any Free Cash used on the original
// order, even when priceDifference is negative (exchanged into a cheaper
// item) - unlike orderReturnService.markReturnRefunded, which does. The
// product never leaves the order on an exchange (it's swapped, not
// returned), so the Free Cash already discounted a line item that's still
// present. Confirmed decision - keep this simple, do not add proportional
// Free Cash refund logic here.
const markExchangeCompleted = async (vendorId, adminUserId, exchangeId) => {
    try {
        const orderExchange = await OrderExchange.findOne({ _id: exchangeId, vendorId });
        if (!orderExchange) {
            return common.returnResult(false, 404, 'Exchange request not found.');
        }
        if (orderExchange.exchangeStatus !== 'REPLACEMENT_SHIPPED') {
            return common.returnResult(false, 400, 'Only a shipped exchange can be marked completed.');
        }

        orderExchange.exchangeStatus = 'COMPLETED';
        orderExchange.completedAt = new Date();
        orderExchange.updatedBy = adminUserId;
        await orderExchange.save();

        logger.logInfo(1, 0, 'Exchange completed', { vendorId, exchangeId });
        return common.returnResult(true, 200, 'Exchange marked as completed', { orderExchange });
    } catch (err) {
        throw err;
    }
};

const fetchMyExchanges = async (vendorId, userId) => {
    try {
        const orderExchanges = await OrderExchange.find({ vendorId, userId, status: { $ne: 'D' } }).sort({ createdAt: -1 });
        return common.returnResult(true, 200, 'Exchange requests fetched successfully', { orderExchanges });
    } catch (err) {
        throw err;
    }
};

const fetchAllExchangesAdmin = async (vendorId) => {
    try {
        const orderExchanges = await OrderExchange.find({ vendorId, status: { $ne: 'D' } }).sort({ createdAt: -1 });
        return common.returnResult(true, 200, 'Exchange requests fetched successfully', { orderExchanges });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    createExchangeRequest,
    approveExchange,
    rejectExchange,
    markExchangePickedUp,
    markExchangeReplacementShipped,
    markExchangeCompleted,
    fetchMyExchanges,
    fetchAllExchangesAdmin
};
