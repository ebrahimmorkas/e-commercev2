const orderReturnService = require('../services/orderReturnService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const createReturnRequest = async (req, res) => {
    const vendorId = req.vendorId;
    const { orderId } = req.params;
    try {
        const result = await orderReturnService.createReturnRequest(
            vendorId, req.user._id, orderId, req.body, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderReturnController: getAllReturnsAdmin - Exception while fetching return requests', { vendorId, error });
    }
};

const approveReturn = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderReturnService.approveReturn(vendorId, req.user._id, id, req.body.remarks);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderReturnController: approveReturn - Exception while approving return', { vendorId, id, error });
    }
};

const rejectReturn = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderReturnService.rejectReturn(vendorId, req.user._id, id, req.body.rejectionReason);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderReturnController: rejectReturn - Exception while rejecting return', { vendorId, id, error });
    }
};

const markReturnPickedUp = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderReturnService.markReturnPickedUp(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderReturnController: markReturnPickedUp - Exception while updating return', { vendorId, id, error });
    }
};

const markReturnRefunded = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderReturnService.markReturnRefunded(
            vendorId, req.user._id, id, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
