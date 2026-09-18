const userService = require('../services/userService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const getAllUsersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await userService.fetchAllUsersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('userController: getAllUsersAdmin - Exception while fetching users', { vendorId, error });
    }
};

const bulkSetUserStatus = async (req, res) => {
    const vendorId = req.vendorId;
    const { userIds, status } = req.body;
    try {
        const result = await userService.bulkSetUserStatus(vendorId, req.user._id, userIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('userController: bulkSetUserStatus - Exception while bulk updating customer status', { vendorId, error });
    }
};

const bulkDeleteUsers = async (req, res) => {
    const vendorId = req.vendorId;
    const { userIds } = req.body;
    try {
        const result = await userService.bulkDeleteUsers(vendorId, req.user._id, userIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('userController: bulkDeleteUsers - Exception while bulk deleting customers', { vendorId, error });
    }
};

module.exports = {
    getAllUsersAdmin,
    bulkSetUserStatus,
    bulkDeleteUsers
};
