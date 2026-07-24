const WebsiteMaster = require('../models/WebsiteMaster.js');
const logger = require('../utils/logger');

const fetchWebsiteMasterData = async () => {
    try {
        logger.logInfo(null,null,'Fetching website master data from DB');
        const websiteMasterData = await WebsiteMaster.findOne();
        if (!websiteMasterData) {
            logger.logError(0,1,`Website master data not found`)
            return null;
        }
        logger.logInfo(1,0,`Website Master data fetched succesfully`);
        return websiteMasterData;
    } catch (err) {
        logger.logException(`Exception while fetching the website master data from DB in service`, {err})
        return null;
    }

}

module.exports = {
  fetchWebsiteMasterData
};