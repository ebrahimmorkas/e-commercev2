const weightMasterService = require('../services/weightMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Mirrors unitMasterController.getUnits - exposes the existing
// weightMasterService.fetchAllWeights() (previously internal-only, used by
// productService's weight-unit validation and shipping calculations) so the
// admin product form can list real WeightMaster entries.
const getWeights = async (req, res) => {
  try {
    const weights = await weightMasterService.fetchAllWeights();
    return common.sendSuccess(res, 200, 'Weights fetched successfully', weights);
  } catch (error) {
    logger.logException('Error fetching weights', { error });
    return common.sendError(res, 500, 'Failed to fetch weights');
  }
};

module.exports = {
  getWeights,
};
