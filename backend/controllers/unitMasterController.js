const unitMasterService = require('../services/unitMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// UnitMaster is global (no vendorId/audit fields) - only _id needs encoding.
const formatUnitForResponse = (unitDoc) => {
  if (!unitDoc) return unitDoc;
  const unit = unitDoc.toObject ? unitDoc.toObject() : unitDoc;
  return { ...unit, _id: unit._id ? common.encodeId(unit._id) : unit._id };
};

const getUnits = async (req, res) => {
  try {
    const result = await unitMasterService.fetchAllUnits();

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.map(formatUnitForResponse));
  } catch (error) {
    logger.logException('Error fetching units', { error });
  }
};

module.exports = {
  getUnits,
};