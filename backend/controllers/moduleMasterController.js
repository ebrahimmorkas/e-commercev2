const moduleMasterService = require('../services/moduleMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Converts a ModuleMaster mongoose doc into a response-safe object with
// every ObjectId field encoded via common.encodeId. getMyAssignedModules
// never returns a raw doc (just { code, moduleName, precedence }), so this
// is only needed for the admin catalog listing.
const formatModuleForResponse = (moduleDoc) => {
    if (!moduleDoc) return moduleDoc;
    const module = moduleDoc.toObject ? moduleDoc.toObject() : moduleDoc;

    return {
        ...module,
        _id: module._id ? common.encodeId(module._id) : module._id,
        createdBy: module.createdBy ? common.encodeId(module.createdBy) : module.createdBy,
        updatedBy: module.updatedBy ? common.encodeId(module.updatedBy) : module.updatedBy,
        deletedBy: module.deletedBy ? common.encodeId(module.deletedBy) : module.deletedBy,
        activeMarkedBy: module.activeMarkedBy ? common.encodeId(module.activeMarkedBy) : module.activeMarkedBy,
        inActiveMarkedBy: module.inActiveMarkedBy ? common.encodeId(module.inActiveMarkedBy) : module.inActiveMarkedBy,
    };
};

const getAllModulesAdmin = async (req, res) => {
    try {
        const result = await moduleMasterService.fetchAllModulesAdmin();
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta.modules.map(formatModuleForResponse));
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
        const websiteMasterData = req.websiteMasterData;
        const result = await moduleMasterService.fetchAssignedModulesForVendor(companyMasterData, websiteMasterData);
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
