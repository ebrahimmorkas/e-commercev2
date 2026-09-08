const orderService = require('../services/orderService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Same shape as cartController.js's buildLocationContext - order creation
// is login-only, but the tax/exclusion revalidation inside checkoutCart
// still needs a full location context.
const buildLocationContext = (req) => ({
    countryId: req.user.country || null,
    stateId: req.user.state || null,
    cityId: req.user.city || null,
    zipCode: null
});

const createOrder = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user._id;
        const locationContext = buildLocationContext(req);

        const result = await orderService.createOrderFromCart(
            vendorId,
            userId,
            req.user.country || null,
            locationContext,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            req.body
        );

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: createOrder - Exception while creating order', { vendorId, error });
    }
};

const getMyOrders = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchMyOrders(vendorId, req.user._id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getMyOrders - Exception while fetching orders', { vendorId, error });
    }
};

// Customer-facing single-order view, gated behind the order-tracking
// feature (both WebsiteMaster and CompanyMaster must have it on).
const getMyOrderById = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const trackingFeatureCheck = await common.checkFeatureOnOrOff(
            vendorId, req.websiteMasterData, req.companyMasterData,
            'isOrderTrakingAllowed', 'isOrderTrakingAllowed'
        );
        if (!trackingFeatureCheck.isSuccess) {
            return common.sendError(res, trackingFeatureCheck.statusCode, trackingFeatureCheck.message);
        }

        const result = await orderService.fetchOrderById(vendorId, id, req.user._id, false);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getMyOrderById - Exception while fetching order', { vendorId, id, error });
    }
};

const cancelOrder = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.cancelOrder(
            vendorId, req.user._id, id, req.body.cancellationReason, req.companySettingsData, req.companyMasterData, req.websiteMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: cancelOrder - Exception while cancelling order', { vendorId, id, error });
    }
};

const getAllOrdersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await orderService.fetchAllOrdersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getAllOrdersAdmin - Exception while fetching orders', { vendorId, error });
    }
};

const getOrderByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.fetchOrderById(vendorId, id, null, true);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: getOrderByIdAdmin - Exception while fetching order', { vendorId, id, error });
    }
};

const advanceOrderStep = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const { targetStepCode, remarks } = req.body;
        const result = await orderService.advanceOrderStep(
            vendorId, req.user._id, id, targetStepCode, remarks, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: advanceOrderStep - Exception while advancing order step', { vendorId, id, error });
    }
};

const assignDeliveryAgent = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.assignDeliveryAgent(
            vendorId, req.user._id, id, req.body.deliveryAgentUserId, req.companyMasterData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: assignDeliveryAgent - Exception while assigning delivery agent', { vendorId, id, error });
    }
};

const deliveryAgentMarkDelivered = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await orderService.deliveryAgentMarkDelivered(
            vendorId, req.user._id, id, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('orderController: deliveryAgentMarkDelivered - Exception while marking order delivered', { vendorId, id, error });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getMyOrderById,
    cancelOrder,
    getAllOrdersAdmin,
    getOrderByIdAdmin,
    advanceOrderStep,
    assignDeliveryAgent,
    deliveryAgentMarkDelivered
};
