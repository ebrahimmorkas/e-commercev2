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

// Maps a non-system module's code to the boolean flag (present on BOTH
// WebsiteMaster and CompanyMaster) that actually turns that feature on. A
// module with no entry here (the system modules - DASHBOARD, PRODUCTS,
// ORDERS, CUSTOMERS, COMPANY_SETTINGS) has no such flag, so it's never
// gated by isModuleFeatureEnabled. Single source of truth - also used by
// seeds/backfillAssignedModules.js, so the two never drift apart.
const MODULE_FEATURE_FLAG = {
    BULK_UPDATE_PRODUCTS: 'isBulkUpdatingProductsAllowed',
    CATEGORIES: 'isCategoryFeatureOn',
    BRAND: 'isBrandFeatureOn',
    DISCOUNT: 'isDiscountFeatureOn',
    BANNER: 'isBannerFeatureOn',
    ANNOUNCEMENT: 'isAnnouncementFeatureOn',
    ABANDONED_CART: 'isAbondonedCartFeatureOn',
    FREE_CASH: 'isFreeCashFeatureOn',
    GROUP: 'isGroupFeatureOn',
    EMAIL_TEMPLATE: 'isEmailTemplateFeatureOn',
    ADMIN_PLACE_ORDER: 'isAdminPlacingOrderOnBehalfOfUserIsOn'
};

// A module can be actively assigned yet still be effectively off if whoever
// assigned it forgot that isCategoryFeatureOn/isDiscountFeatureOn/etc. also
// has to be true on BOTH masters (admin may have assigned the module without
// realizing the feature itself is off) - this catches that mismatch for
// sidebar display. Modules with no mapped flag (system modules) are always
// considered enabled here.
const isModuleFeatureEnabled = (moduleCode, websiteMasterData, companyMasterData) => {
    const flag = MODULE_FEATURE_FLAG[moduleCode];
    if (!flag) return true;
    return !!(websiteMasterData?.[flag] && companyMasterData?.[flag]);
};

// Resolves companyMasterData.assignedModules (raw moduleId + dates) into the
// currently-active modules' codes/names - what the admin frontend uses to
// decide which sidebar sections to show for this vendor. A module must be
// both actively assigned AND (for non-system modules) have its feature flag
// on in both WebsiteMaster and CompanyMaster to show up here.
const fetchAssignedModulesForVendor = async (companyMasterData, websiteMasterData) => {
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
            .filter((module) => isModuleFeatureEnabled(module.code, websiteMasterData, companyMasterData))
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
    MODULE_FEATURE_FLAG,
    isModuleFeatureEnabled,
    fetchAssignedModulesForVendor
};
