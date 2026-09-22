const paymentService = require('../services/paymentService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// Converts a PaymentTransaction mongoose doc into a response-safe object
// with every ObjectId field encoded.
const formatTransactionForResponse = (txnDoc) => {
    if (!txnDoc) return txnDoc;
    const txn = txnDoc.toObject ? txnDoc.toObject() : txnDoc;

    return {
        ...txn,
        _id: encodeIfPresent(txn._id),
        vendorId: encodeIfPresent(txn.vendorId),
        orderId: encodeIfPresent(txn.orderId),
        userId: encodeIfPresent(txn.userId),
        createdBy: encodeIfPresent(txn.createdBy),
        updatedBy: encodeIfPresent(txn.updatedBy),
        deletedBy: encodeIfPresent(txn.deletedBy),
        activeMarkedBy: encodeIfPresent(txn.activeMarkedBy),
        inActiveMarkeddBy: encodeIfPresent(txn.inActiveMarkeddBy),
    };
};

// selectCashOnDelivery returns the full updated Order - reuse the exact
// same field set orderController.js's formatOrderForResponse encodes
// (duplicated rather than shared/exported, matching how
// adminPlaceOrderController.js already duplicates its own order formatter
// in this codebase rather than the two controllers importing from each other).
const formatOrderForPaymentResponse = (orderDoc) => {
    if (!orderDoc) return orderDoc;
    const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

    return {
        ...order,
        _id: encodeIfPresent(order._id),
        cartId: encodeIfPresent(order.cartId),
        vendorId: encodeIfPresent(order.vendorId),
        userId: encodeIfPresent(order.userId),
        orderStepMasterId: encodeIfPresent(order.orderStepMasterId),
        currentStepId: encodeIfPresent(order.currentStepId),
        currencyId: encodeIfPresent(order.currencyId),
        shippingAddressId: encodeIfPresent(order.shippingAddressId),
        billingAddressId: encodeIfPresent(order.billingAddressId),
        placedByAdminId: encodeIfPresent(order.placedByAdminId),
        assignedDeliveryAgentId: encodeIfPresent(order.assignedDeliveryAgentId),
        cancelledBy: encodeIfPresent(order.cancelledBy),
        createdBy: encodeIfPresent(order.createdBy),
        updatedBy: encodeIfPresent(order.updatedBy),
        deletedBy: encodeIfPresent(order.deletedBy),
        activeMarkedBy: encodeIfPresent(order.activeMarkedBy),
        inActiveMarkedBy: encodeIfPresent(order.inActiveMarkedBy),
        statusHistory: Array.isArray(order.statusHistory)
            ? order.statusHistory.map((entry) => ({
                ...entry,
                _id: encodeIfPresent(entry._id),
                stepId: encodeIfPresent(entry.stepId),
                changedBy: encodeIfPresent(entry.changedBy),
            }))
            : order.statusHistory,
        items: Array.isArray(order.items)
            ? order.items.map((item) => ({
                ...item,
                productId: encodeIfPresent(item.productId),
                variantId: encodeIfPresent(item.variantId),
                sizeId: encodeIfPresent(item.sizeId),
                taxBreakdown: Array.isArray(item.taxBreakdown)
                    ? item.taxBreakdown.map((tax) => ({ ...tax, taxId: encodeIfPresent(tax.taxId) }))
                    : item.taxBreakdown,
            }))
            : order.items,
    };
};

const initiateOnlinePayment = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isPaymentGatewayFeatureOn', 'isPaymentGatewayFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await paymentService.initiateOnlinePayment(
            vendorId, req.user._id, common.decodeId(req.params.orderId), req.vendorData?.domain,
            websiteMasterData, companyMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            transactionId: encodeIfPresent(result.meta.transactionId),
        });
    } catch (error) {
        logger.logException('paymentController: initiateOnlinePayment - Exception while initiating online payment', { vendorId, error });
    }
};

const selectCashOnDelivery = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const websiteMasterData = req.websiteMasterData;
        const companyMasterData = req.companyMasterData;
        const validityResult = await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, 'isCODFeatureOn', 'isCODFeatureOn');
        if (!validityResult.isSuccess) {
            return common.sendError(res, validityResult.statusCode, validityResult.message);
        }

        const result = await paymentService.selectCashOnDelivery(vendorId, req.user._id, common.decodeId(req.params.orderId));
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { order: formatOrderForPaymentResponse(result.meta.order) });
    } catch (error) {
        logger.logException('paymentController: selectCashOnDelivery - Exception while selecting cash on delivery', { vendorId, error });
    }
};

const getPaymentStatus = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await paymentService.getPaymentStatus(vendorId, req.user._id, common.decodeId(req.params.orderId));
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        // payment (Order.payment, orderPaymentSchema) has no ObjectId fields
        // of its own - only transaction (a PaymentTransaction doc) needs encoding.
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            transaction: formatTransactionForResponse(result.meta.transaction),
        });
    } catch (error) {
        logger.logException('paymentController: getPaymentStatus - Exception while fetching payment status', { vendorId, error });
    }
};

// Public webhook - called server-to-server by the gateway itself, never by
// a logged-in user, so there is no req.user here. req.vendorId still comes
// from vendorDetection (this route is hit on the vendor's own domain, same
// as every other route - see server.js).
const handleGatewayCallback = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await paymentService.handleGatewayCallback(vendorId, req.params.gateway, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('paymentController: handleGatewayCallback - Exception while handling gateway callback', { vendorId, error });
    }
};

module.exports = {
    initiateOnlinePayment,
    selectCashOnDelivery,
    getPaymentStatus,
    handleGatewayCallback
};
