const unitMasterService = require('../services/unitMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

const getUnits = async (req, res) => {
  try {
    const result = await unitMasterService.fetchAllUnits();

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching units', { error });
  }
};

module.exports = {
  getUnits,
};