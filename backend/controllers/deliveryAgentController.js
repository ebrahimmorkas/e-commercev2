const deliveryAgentService = require('../services/deliveryAgentService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const mongoose = require('mongoose');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// country/state/city hold location ids, encoded like every other id so they
// match the location dropdown values (same as userController).
const encodeLocationValue = (value) => (value && mongoose.Types.ObjectId.isValid(value) ? common.encodeId(value) : value);

const decodeLocationFields = (body) => {
    const decoded = { ...body };
    ['country', 'state', 'city'].forEach((field) => {
        if (decoded[field]) decoded[field] = common.tryDecodeId(decoded[field]);
    });
    return decoded;
};

const formatAgentForResponse = (agent) => {
    if (!agent) return agent;
    return {
        ...agent,
        _id: encodeIfPresent(agent._id),
        country: encodeLocationValue(agent.country),
        state: encodeLocationValue(agent.state),
        city: encodeLocationValue(agent.city),
    };
};

const getDeliveryAgents = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await deliveryAgentService.fetchDeliveryAgents(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            agents: result.meta.agents.map(formatAgentForResponse),
        });
    } catch (error) {
        logger.logException('deliveryAgentController: getDeliveryAgents - Exception while fetching delivery agents', { vendorId, error });
    }
};

const getAssignableDeliveryAgents = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await deliveryAgentService.fetchAssignableDeliveryAgents(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            agents: result.meta.agents.map(formatAgentForResponse),
        });
    } catch (error) {
        logger.logException('deliveryAgentController: getAssignableDeliveryAgents - Exception while fetching delivery agents', { vendorId, error });
    }
};

const getDeliveryAgentById = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await deliveryAgentService.fetchDeliveryAgentById(vendorId, id, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatAgentForResponse(result.meta.agent));
    } catch (error) {
        logger.logException('deliveryAgentController: getDeliveryAgentById - Exception while fetching delivery agent', { vendorId, id, error });
    }
};

const createDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await deliveryAgentService.createDeliveryAgent(vendorId, req.user._id, decodeLocationFields(req.body), req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatAgentForResponse(result.meta.agent));
    } catch (error) {
        logger.logException('deliveryAgentController: createDeliveryAgent - Exception while creating delivery agent', { vendorId, error });
    }
};

const updateDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await deliveryAgentService.updateDeliveryAgent(vendorId, req.user._id, id, decodeLocationFields(req.body), req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatAgentForResponse(result.meta.agent));
    } catch (error) {
        logger.logException('deliveryAgentController: updateDeliveryAgent - Exception while updating delivery agent', { vendorId, id, error });
    }
};

const changeDeliveryAgentPassword = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await deliveryAgentService.changeDeliveryAgentPassword(vendorId, req.user._id, id, req.body.newPassword, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('deliveryAgentController: changeDeliveryAgentPassword - Exception while changing delivery agent password', { vendorId, id, error });
    }
};

const setDeliveryAgentStatus = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await deliveryAgentService.setDeliveryAgentStatus(vendorId, req.user._id, id, req.body.status, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('deliveryAgentController: setDeliveryAgentStatus - Exception while changing delivery agent status', { vendorId, id, error });
    }
};

const deleteDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await deliveryAgentService.deleteDeliveryAgent(vendorId, req.user._id, id, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('deliveryAgentController: deleteDeliveryAgent - Exception while deleting delivery agent', { vendorId, id, error });
    }
};

// The logged-in agent's own orders ("My Deliveries").
const getMyAgentOrders = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const view = req.query.view === 'done' ? 'done' : 'pending';
        const result = await deliveryAgentService.fetchAgentOrders(vendorId, req.user._id, view, req.websiteMasterData, req.companyMasterData, req.companySettingsData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            orders: result.meta.orders.map((order) => ({ ...order, _id: encodeIfPresent(order._id) })),
        });
    } catch (error) {
        logger.logException('deliveryAgentController: getMyAgentOrders - Exception while fetching agent orders', { vendorId, error });
    }
};

module.exports = {
    getDeliveryAgents,
    getAssignableDeliveryAgents,
    getDeliveryAgentById,
    createDeliveryAgent,
    updateDeliveryAgent,
    changeDeliveryAgentPassword,
    setDeliveryAgentStatus,
    deleteDeliveryAgent,
    getMyAgentOrders
};
