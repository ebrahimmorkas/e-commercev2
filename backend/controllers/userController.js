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

module.exports = {
    getAllUsersAdmin
};
