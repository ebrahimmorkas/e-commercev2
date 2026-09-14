const ModuleMaster = require('../models/ModuleMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');

// All active modules, cached as one list (ModuleMaster is a small, global,
// admin-managed catalog - same "single cached snapshot" convention as
// websiteMasterService.fetchWebsiteMasterData).
const fetchAllActiveModules = async () => {
    try {
        const modules = await redisService.getOrSet(
            redisKeys.moduleMaster(),
            async () => await ModuleMaster.find({ status: 'A' }).lean(),
            3600
        );
        return common.returnResult(true, 200, 'Modules fetched successfully', { modules: modules || [] });
    } catch (err) {
        throw err;
    }
};

// Admin catalog listing - straight from DB (not the redis-cached snapshot
// fetchAllActiveModules/fetchModuleByCode use), since this is an infrequent
// admin-only read and should reflect inactive modules too.
const fetchAllModulesAdmin = async () => {
    try {
        const modules = await ModuleMaster.find(
            { status: { $in: ['A', 'I'] } },
            null,
            { sort: { precedence: 1, moduleName: 1 } }
        );
        return common.returnResult(true, 200, 'Modules fetched successfully', { modules });
    } catch (err) {
        throw err;
    }
};

const fetchModuleByCode = async (code) => {
    try {
        const allModulesResult = await fetchAllActiveModules();
        if (!allModulesResult.isSuccess) {
            return allModulesResult;
        }

        const module = allModulesResult.meta.modules.find((m) => m.code === code);
        if (!module) {
            return common.returnResult(false, 404, `Module with code "${code}" not found.`);
        }

        return common.returnResult(true, 200, 'Module fetched successfully', { module });
    } catch (err) {
        throw err;
    }
};

// Single source of truth for "is this CompanyMaster.assignedModules entry
// usable right now" - shared by checkModuleAssigned (per-route gate) and
// fetchMyAssignedModules (sidebar listing) so the two never drift apart.
const isAssignmentActive = (assignment, now = new Date()) => {
    if (!assignment || assignment.revokedAt) return false;
    if (assignment.startDate && now < new Date(assignment.startDate)) return false;
    if (assignment.expiryDate && now > new Date(assignment.expiryDate)) return false;
    return true;
};

// Resolves companyMasterData.assignedModules (raw moduleId + dates) into the
// currently-active modules' codes/names - what the admin frontend uses to
// decide which sidebar sections to show for this vendor.
const fetchAssignedModulesForVendor = async (companyMasterData) => {
    try {
        const allModulesResult = await fetchAllActiveModules();
        if (!allModulesResult.isSuccess) {
            return allModulesResult;
        }

        const modulesById = new Map(allModulesResult.meta.modules.map((m) => [m._id.toString(), m]));
        const assignedModules = companyMasterData?.assignedModules || [];
        const now = new Date();

        const activeModules = assignedModules
            .filter((assignment) => isAssignmentActive(assignment, now))
            .map((assignment) => modulesById.get(assignment.moduleId.toString()))
            .filter(Boolean)
            .map((module) => ({ code: module.code, moduleName: module.moduleName, precedence: module.precedence }))
            .sort((a, b) => a.precedence - b.precedence);

        return common.returnResult(true, 200, 'Assigned modules fetched successfully', { modules: activeModules });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchAllActiveModules,
    fetchAllModulesAdmin,
    fetchModuleByCode,
    isAssignmentActive,
    fetchAssignedModulesForVendor
};
