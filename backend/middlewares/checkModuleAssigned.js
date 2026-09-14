const moduleMasterService = require('../services/moduleMasterService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Factory - the module code is fixed per route, e.g.:
//   router.post('/x', authenticate, authorize('admin', 'user'), vendorDetection,
//     ensureVendorDataCached, checkModuleAssigned('DISCOUNT'), controller);
// Must run after vendorDetection + ensureVendorDataCached, since it reads
// req.vendorId and req.companyMasterData off the request rather than
// re-fetching them.
const checkModuleAssigned = (code) => {
    return async (req, res, next) => {
        try {
            const companyMasterData = req.companyMasterData;
            if (!companyMasterData) {
                logger.logInfo(0, 1, 'checkModuleAssigned - companyMasterData missing on request', { code });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to load vendor configuration'
                });
            }

            const moduleResult = await moduleMasterService.fetchModuleByCode(code);
            if (!moduleResult.isSuccess) {
                return common.sendError(res, moduleResult.statusCode, moduleResult.message);
            }

            const module = moduleResult.meta.module;
            const assignedModules = companyMasterData.assignedModules || [];
            const assignment = assignedModules.find(
                (entry) => entry.moduleId && entry.moduleId.toString() === module._id.toString()
            );

            if (!assignment) {
                return common.sendError(res, 403, `The "${module.moduleName}" module is not assigned to your account.`);
            }

            if (assignment.revokedAt) {
                return common.sendError(res, 403, `The "${module.moduleName}" module has been revoked for your account.`);
            }

            const now = new Date();

            if (assignment.startDate && now < new Date(assignment.startDate)) {
                return common.sendError(res, 403, `The "${module.moduleName}" module is not active yet for your account.`);
            }

            if (assignment.expiryDate && now > new Date(assignment.expiryDate)) {
                return common.sendError(res, 403, `The "${module.moduleName}" module has expired for your account.`);
            }

            req.moduleAssignment = assignment;
            next();
        } catch (error) {
            logger.logException('Exception in checkModuleAssigned middleware', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify module assignment'
            });
        }
    };
};

module.exports = checkModuleAssigned;
