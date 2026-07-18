const WebsiteMaster = require('../models/WebsiteMaster');
const logger = require('../utils/logger');

const fetchWebsiteMasterData = async () => {
    try {
        logger.logInfo('Fetching website master data from DB');
        const websiteMasterData = await WebsiteMaster.findOne();
        if (!websiteMasterData) {
            logger.logError(`WEBSITE MASTER DATA NOT FOUND`)
            return null;
        }
        logger.logInfo(`Website Master data fetched succesfully`);
        return websiteMasterData;
    } catch (err) {
        logger.logException(`Exception while fetching the website master data from DB in service`, {err})
        return null;
    }

}

module.exports = {
  fetchWebsiteMasterData
};