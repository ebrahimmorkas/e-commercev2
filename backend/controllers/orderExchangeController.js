const orderExchangeService = require('../services/orderExchangeService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const createExchangeRequest = async (req, res) => {
    const vendorId = req.vendorId;
    const { orderId } = req.params;
    try {
        const result = await orderExchangeService.createExchangeRequest(
            vendorId, req.user._id, orderId, req.body, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderExchangeController: getAllExchangesAdmin - Exception while fetching exchange requests', { vendorId, error });
    }
};

const approveExchange = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderExchangeService.approveExchange(vendorId, req.user._id, id, req.body.remarks);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderExchangeController: approveExchange - Exception while approving exchange', { vendorId, id, error });
    }
};

const rejectExchange = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderExchangeService.rejectExchange(vendorId, req.user._id, id, req.body.rejectionReason);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderExchangeController: rejectExchange - Exception while rejecting exchange', { vendorId, id, error });
    }
};

const markExchangePickedUp = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderExchangeService.markExchangePickedUp(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderExchangeController: markExchangePickedUp - Exception while updating exchange', { vendorId, id, error });
    }
};

const markExchangeReplacementShipped = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderExchangeService.markExchangeReplacementShipped(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderExchangeController: markExchangeReplacementShipped - Exception while updating exchange', { vendorId, id, error });
    }
};

const markExchangeCompleted = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderExchangeService.markExchangeCompleted(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
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
