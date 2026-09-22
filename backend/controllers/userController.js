const userService = require('../services/userService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts a User mongoose doc (or the plain-object projections
// userService builds by hand) into a response-safe object with every
// ObjectId field encoded via common.encodeId. Fields are guarded since
// most projections only ever carry _id - note User.js's audit fields use
// non-standard names (updated_by snake_case, inActiveMarkedBy single-d)
// unlike the rest of the app's inActiveMarkeddBy.
const formatUserForResponse = (userDoc) => {
    if (!userDoc) return userDoc;
    const user = userDoc.toObject ? userDoc.toObject() : userDoc;

    return {
        ...user,
        _id: user._id ? common.encodeId(user._id) : user._id,
        vendorId: user.vendorId ? common.encodeId(user.vendorId) : user.vendorId,
        createdBy: user.createdBy ? common.encodeId(user.createdBy) : user.createdBy,
        updated_by: user.updated_by ? common.encodeId(user.updated_by) : user.updated_by,
        deletedBy: user.deletedBy ? common.encodeId(user.deletedBy) : user.deletedBy,
        activeMarkedBy: user.activeMarkedBy ? common.encodeId(user.activeMarkedBy) : user.activeMarkedBy,
        inActiveMarkedBy: user.inActiveMarkedBy ? common.encodeId(user.inActiveMarkedBy) : user.inActiveMarkedBy,
    };
};

const getAllUsersAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await userService.fetchAllUsersAdmin(vendorId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.users.map(formatUserForResponse));
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
        return common.sendSuccess(res, result.statusCode, result.message, formatUserForResponse(result.meta.user));
    } catch (error) {
        logger.logException('userController: createUserByAdmin - Exception while creating user', { vendorId, error });
    }
};

const getUserByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await userService.fetchUserByIdAdmin(vendorId, id);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatUserForResponse(result.meta.user));
    } catch (error) {
        logger.logException('userController: getUserByIdAdmin - Exception while fetching user', { vendorId, id, error });
    }
};

const updateUserByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
        const result = await userService.updateUserByAdmin(vendorId, req.user._id, id, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, formatUserForResponse(result.meta.user));
    } catch (error) {
        logger.logException('userController: updateUserByAdmin - Exception while updating user', { vendorId, id, error });
    }
};

const changePasswordByAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    let id;
    try {
        id = common.decodeId(req.params.id);
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
    let id;
    try {
        id = common.decodeId(req.params.id);
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
    const { status } = req.body;
    try {
        const decodedIds = req.body.userIds.map((id) => common.decodeId(id));
        const result = await userService.bulkSetUserStatus(vendorId, req.user._id, decodedIds, status);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
    } catch (error) {
        logger.logException('userController: bulkSetUserStatus - Exception while bulk updating customer status', { vendorId, error });
    }
};

const bulkDeleteUsers = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const decodedIds = req.body.userIds.map((id) => common.decodeId(id));
        const result = await userService.bulkDeleteUsers(vendorId, req.user._id, decodedIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const meta = {
            ...result.meta,
            results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
        };
        return common.sendSuccess(res, result.statusCode, result.message, meta);
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
