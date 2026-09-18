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
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.users);
    } catch (error) {
        logger.logException('userController: getAllUsersAdmin - Exception while fetching users', { vendorId, error });
    }
};

const createUserByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await userService.createUserByAdmin(vendorId, req.user._id, req.body, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.user);
    } catch (error) {
        logger.logException('userController: createUserByAdmin - Exception while creating user', { vendorId, error });
    }
};

const getUserByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await userService.fetchUserByIdAdmin(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.user);
    } catch (error) {
        logger.logException('userController: getUserByIdAdmin - Exception while fetching user', { vendorId, id, error });
    }
};

const updateUserByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await userService.updateUserByAdmin(vendorId, req.user._id, id, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.user);
    } catch (error) {
        logger.logException('userController: updateUserByAdmin - Exception while updating user', { vendorId, id, error });
    }
};

const changePasswordByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await userService.changePasswordByAdmin(vendorId, req.user._id, id, req.body.newPassword, req.websiteMasterData, req.companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('userController: changePasswordByAdmin - Exception while changing user password', { vendorId, id, error });
    }
};

const deleteUserByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    const { id } = req.params;
    try {
        const result = await userService.deleteUserByAdmin(vendorId, req.user._id, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('userController: deleteUserByAdmin - Exception while deleting user', { vendorId, id, error });
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
    createUserByAdmin,
    getAllUsersAdmin,
    getUserByIdAdmin,
    updateUserByAdmin,
    changePasswordByAdmin,
    deleteUserByAdmin,
    bulkSetUserStatus,
    bulkDeleteUsers
};
