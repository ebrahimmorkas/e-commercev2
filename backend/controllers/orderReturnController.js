const orderReturnService = require('../services/orderReturnService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// Converts an OrderReturn mongoose doc into a response-safe object with
// every ObjectId field (including its nested items[]) encoded.
const formatReturnForResponse = (returnDoc) => {
    if (!returnDoc) return returnDoc;
    const ret = returnDoc.toObject ? returnDoc.toObject() : returnDoc;

    return {
        ...ret,
        _id: encodeIfPresent(ret._id),
        vendorId: encodeIfPresent(ret.vendorId),
        orderId: encodeIfPresent(ret.orderId),
        userId: encodeIfPresent(ret.userId),
        approvedBy: encodeIfPresent(ret.approvedBy),
        rejectedBy: encodeIfPresent(ret.rejectedBy),
        createdBy: encodeIfPresent(ret.createdBy),
        updatedBy: encodeIfPresent(ret.updatedBy),
        deletedBy: encodeIfPresent(ret.deletedBy),
        activeMarkedBy: encodeIfPresent(ret.activeMarkedBy),
        inActiveMarkedBy: encodeIfPresent(ret.inActiveMarkedBy),
        items: Array.isArray(ret.items)
            ? ret.items.map((item) => ({
                ...item,
                productId: encodeIfPresent(item.productId),
                variantId: encodeIfPresent(item.variantId),
                sizeId: encodeIfPresent(item.sizeId),
            }))
            : ret.items,
    };
};

const formatReturnListForResponse = (meta) => {
    if (Array.isArray(meta)) return meta.map(formatReturnForResponse);
    // Matches orderReturnService's actual returnResult meta keys exactly:
    // { orderReturns } for every list endpoint, { orderReturn } for every
    // single-item one (create/approve/reject/markPickedUp/markRefunded) -
    // NOT the generic "returns"/"return" this previously (and wrongly)
    // checked for, which silently fell through to the unformatted `meta`
    // on every single call.
    if (meta && Array.isArray(meta.orderReturns)) return { ...meta, orderReturns: meta.orderReturns.map(formatReturnForResponse) };
    if (meta && meta.orderReturn) return { ...meta, orderReturn: formatReturnForResponse(meta.orderReturn) };
    return meta;
};

const createReturnRequest = async (req, res) => {
    const vendorId = req.vendorId;
    let orderId;
    try {
        orderId = common.decodeId(req.params.orderId);
        const body = {
            ...req.body,
            items: req.body.items
                ? req.body.items.map((item) => ({
                    ...item,
                    productId: item.productId ? common.decodeId(item.productId) : item.productId,
                    variantId: item.variantId ? common.decodeId(item.variantId) : item.variantId,
                    sizeId: item.sizeId ? common.decodeId(item.sizeId) : item.sizeId,
                }))
                : req.body.items,
        };
        const result = await orderReturnService.createReturnRequest(
            vendorId, req.user._id, orderId, body, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: createReturnRequest - Exception while creating return request', { vendorId, orderId, error });
    }
};

const getMyReturns = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderReturnService.fetchMyReturns(vendorId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: getMyReturns - Exception while fetching return requests', { vendorId, error });
    }
};

const getAllReturnsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderReturnService.fetchAllReturnsAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: getAllReturnsAdmin - Exception while fetching return requests', { vendorId, error });
    }
};

const approveReturn = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderReturnService.approveReturn(vendorId, req.user._id, id, req.body.remarks);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: approveReturn - Exception while approving return', { vendorId, id, error });
    }
};

const rejectReturn = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderReturnService.rejectReturn(vendorId, req.user._id, id, req.body.rejectionReason);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: rejectReturn - Exception while rejecting return', { vendorId, id, error });
    }
};

const markReturnPickedUp = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderReturnService.markReturnPickedUp(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: markReturnPickedUp - Exception while updating return', { vendorId, id, error });
    }
};

const markReturnRefunded = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await orderReturnService.markReturnRefunded(
            vendorId, req.user._id, id, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatReturnListForResponse(result.meta));
    } catch (error) {
        logger.logException('orderReturnController: markReturnRefunded - Exception while updating return', { vendorId, id, error });
    }
};

module.exports = {
    createReturnRequest,
    getMyReturns,
    getAllReturnsAdmin,
    approveReturn,
    rejectReturn,
    markReturnPickedUp,
    markReturnRefunded
};
