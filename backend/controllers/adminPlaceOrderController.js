const adminPlaceOrderService = require('../services/adminPlaceOrderService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const getUserSearchFields = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUserSearchFields(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.fields);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUserSearchFields - Exception while fetching search fields', { vendorId, error });
    }
};

const getUsersBySearchField = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUsersBySearchField(vendorId, req.websiteMasterData, req.companyMasterData, req.query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.users);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUsersBySearchField - Exception while fetching users', { vendorId, error });
    }
};

const getUserAddresses = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchUserAddresses(vendorId, req.websiteMasterData, req.companyMasterData, req.params.userId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.addresses);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getUserAddresses - Exception while fetching addresses', { vendorId, error });
    }
};

const getCategories = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchCategories(vendorId, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.categories);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getCategories - Exception while fetching categories', { vendorId, error });
    }
};

const getProducts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchActiveProducts(vendorId, req.websiteMasterData, req.companyMasterData, req.query);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.products);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getProducts - Exception while fetching products', { vendorId, error });
    }
};

const getProductOptions = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.fetchProductOptions(
            vendorId, req.websiteMasterData, req.companyMasterData, req.companySettingsData, req.params.productId
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('adminPlaceOrderController: getProductOptions - Exception while fetching product options', { vendorId, error });
    }
};

const placeOrder = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await adminPlaceOrderService.placeOrderOnBehalfOfUser(
            vendorId, req.user._id, req.websiteMasterData, req.companyMasterData, req.companySettingsData, req.body
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.order);
    } catch (error) {
        logger.logException('adminPlaceOrderController: placeOrder - Exception while placing order', { vendorId, error });
    }
};

module.exports = {
    getUserSearchFields,
    getUsersBySearchField,
    getUserAddresses,
    getCategories,
    getProducts,
    getProductOptions,
    placeOrder
};
