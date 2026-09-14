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

// Currently-active modules for the logged-in admin's own vendor - what the
// frontend sidebar uses to decide which sections to show/hide.
const getMyAssignedModules = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const companyMasterData = req.companyMasterData;
        const result = await moduleMasterService.fetchAssignedModulesForVendor(companyMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.modules);
    } catch (error) {
        logger.logException('moduleMasterController: getMyAssignedModules - Exception while fetching assigned modules', { vendorId, error });
    }
};

module.exports = {
    getAllModulesAdmin,
    getMyAssignedModules
};
