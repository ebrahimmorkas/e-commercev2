const weightMasterService = require('../services/weightMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// WeightMaster is global (no vendorId/audit fields) - only _id needs encoding.
const formatWeightForResponse = (weightDoc) => {
  if (!weightDoc) return weightDoc;
  const weight = weightDoc.toObject ? weightDoc.toObject() : weightDoc;
  return { ...weight, _id: weight._id ? common.encodeId(weight._id) : weight._id };
};

// Mirrors unitMasterController.getUnits - exposes the existing
// weightMasterService.fetchAllWeights() (previously internal-only, used by
// productService's weight-unit validation and shipping calculations) so the
// admin product form can list real WeightMaster entries.
const getWeights = async (req, res) => {
  try {
    const weights = await weightMasterService.fetchAllWeights();
    return common.sendSuccess(res, 200, 'Weights fetched successfully', weights.map(formatWeightForResponse));
  } catch (error) {
    logger.logException('Error fetching weights', { error });
    return common.sendError(res, 500, 'Failed to fetch weights');
  }
};

module.exports = {
  getWeights,
};
