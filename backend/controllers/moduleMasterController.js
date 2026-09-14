const moduleMasterService = require('../services/moduleMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const getAllModulesAdmin = async (req, res) => {
    try {
        const result = await moduleMasterService.fetchAllModulesAdmin();
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.modules);
    } catch (error) {
        logger.logException('moduleMasterController: getAllModulesAdmin - Exception while fetching modules', { error });
    }
};

module.exports = {
    getAllModulesAdmin
};
