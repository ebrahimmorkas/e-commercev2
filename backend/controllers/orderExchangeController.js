const orderExchangeService = require('../services/orderExchangeService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);
const decodeIfPresent = (id) => (id ? common.decodeId(id) : id);

// Converts an OrderExchange mongoose doc into a response-safe object with
// every ObjectId field (including its nested items[]) encoded.
const formatExchangeForResponse = (exchangeDoc) => {
    if (!exchangeDoc) return exchangeDoc;
    const exchange = exchangeDoc.toObject ? exchangeDoc.toObject() : exchangeDoc;

    return {
        ...exchange,
        _id: encodeIfPresent(exchange._id),
        vendorId: encodeIfPresent(exchange.vendorId),
        orderId: encodeIfPresent(exchange.orderId),
        userId: encodeIfPresent(exchange.userId),
        approvedBy: encodeIfPresent(exchange.approvedBy),
        rejectedBy: encodeIfPresent(exchange.rejectedBy),
        createdBy: encodeIfPresent(exchange.createdBy),
        updatedBy: encodeIfPresent(exchange.updatedBy),
        deletedBy: encodeIfPresent(exchange.deletedBy),
        activeMarkedBy: encodeIfPresent(exchange.activeMarkedBy),
        inActiveMarkedBy: encodeIfPresent(exchange.inActiveMarkedBy),
        items: Array.isArray(exchange.items)
            ? exchange.items.map((item) => ({
                ...item,
                productId: encodeIfPresent(item.productId),
                variantId: encodeIfPresent(item.variantId),
                sizeId: encodeIfPresent(item.sizeId),
                requestedProductId: encodeIfPresent(item.requestedProductId),
                requestedVariantId: encodeIfPresent(item.requestedVariantId),
                requestedSizeId: encodeIfPresent(item.requestedSizeId),
            }))
            : exchange.items,
    };
};

const formatExchangeListForResponse = (meta) => {
    if (Array.isArray(meta)) return meta.map(formatExchangeForResponse);
    // Matches orderExchangeService's actual returnResult meta keys exactly:
    // { orderExchanges } for every list endpoint, { orderExchange } for
    // every single-item one - NOT the generic "exchanges"/"exchange" this
    // previously (and wrongly) checked for, which silently fell through to
    // the unformatted `meta` on every single call.
    if (meta && Array.isArray(meta.orderExchanges)) return { ...meta, orderExchanges: meta.orderExchanges.map(formatExchangeForResponse) };
    if (meta && meta.orderExchange) return { ...meta, orderExchange: formatExchangeForResponse(meta.orderExchange) };
    return meta;
};

const createExchangeRequest = async (req, res) => {
    const vendorId = req.vendorId;
    let orderId;
    try {
        orderId = common.decodeId(req.params.orderId);
        const body = {
            ...req.body,
            items: (req.body.items || []).map((item) => ({
                ...item,
                productId: decodeIfPresent(item.productId),
                variantId: decodeIfPresent(item.variantId),
                sizeId: decodeIfPresent(item.sizeId),
                requestedProductId: decodeIfPresent(item.requestedProductId),
                requestedVariantId: decodeIfPresent(item.requestedVariantId),
                requestedSizeId: decodeIfPresent(item.requestedSizeId),
            })),
        };
        const result = await orderExchangeService.createExchangeRequest(
            vendorId, req.user._id, orderId, body, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: createExchangeRequest - Exception while creating exchange request', { vendorId, orderId, error });
    }
};

const getMyExchanges = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderExchangeService.fetchMyExchanges(vendorId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: getMyExchanges - Exception while fetching exchange requests', { vendorId, error });
    }
};

const getAllExchangesAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderExchangeService.fetchAllExchangesAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: getAllExchangesAdmin - Exception while fetching exchange requests', { vendorId, error });
    }
};

const approveExchange = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderExchangeService.approveExchange(vendorId, req.user._id, id, req.body.remarks);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: approveExchange - Exception while approving exchange', { vendorId, id, error });
    }
};

const rejectExchange = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderExchangeService.rejectExchange(vendorId, req.user._id, id, req.body.rejectionReason);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: rejectExchange - Exception while rejecting exchange', { vendorId, id, error });
    }
};

const markExchangePickedUp = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderExchangeService.markExchangePickedUp(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: markExchangePickedUp - Exception while updating exchange', { vendorId, id, error });
    }
};

const markExchangeReplacementShipped = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderExchangeService.markExchangeReplacementShipped(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: markExchangeReplacementShipped - Exception while updating exchange', { vendorId, id, error });
    }
};

const markExchangeCompleted = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderExchangeService.markExchangeCompleted(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatExchangeListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderExchangeController: markExchangeCompleted - Exception while updating exchange', { vendorId, id, error });
    }
};

module.exports = {
    createExchangeRequest,
    getMyExchanges,
    getAllExchangesAdmin,
    approveExchange,
    rejectExchange,
    markExchangePickedUp,
    markExchangeReplacementShipped,
    markExchangeCompleted
};
