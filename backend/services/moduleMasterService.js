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

module.exports = {
    fetchAllActiveModules,
    fetchAllModulesAdmin,
    fetchModuleByCode
};
