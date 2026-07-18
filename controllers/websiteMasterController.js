const websiteMasterService = require('../services/websiteMasterService.js');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getWebsiteMasterData = async (req, res) => {
    try {
        const websiteMasterData = await websiteMasterService.fetchWebsiteMasterData();
        if (!websiteMasterData) {
            logger.logInfo(`Website master data not found`);
            return common.sendError(res, 404, `Website master data not found`);
        }
        logger.logInfo(`Website master data fetched successfully`, { websiteMasterData });
        return common.sendSuccess(res, 200, `Website master data fetched successfully`, websiteMasterData);
    } catch (err) {
        logger.logException(`Exception in websiteMasterController in getWebsiteMasterData function`, { err });
        return null;
    }
}

module.exports = {
    getWebsiteMasterData
};