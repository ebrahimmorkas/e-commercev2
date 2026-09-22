const sizeMasterService = require('../services/sizeMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// SizeMaster is global (no vendorId/audit fields), but each measurement
// subdocument carries its own _id (the id Product create/update uses to
// identify a measurement - see sizeMasterService.shapeSize) and a populated
// allowedUnits[] (UnitMaster subdocuments) - all three levels of id need
// encoding, not just the top-level _id.
const formatSizeForResponse = (size) => {
  if (!size) return size;
  return {
    ...size,
    _id: size._id ? common.encodeId(size._id) : size._id,
    measurements: size.measurements
      ? size.measurements.map((measurement) => ({
          ...measurement,
          _id: measurement._id ? common.encodeId(measurement._id) : measurement._id,
          allowedUnits: (measurement.allowedUnits || []).map((unit) => ({
            ...unit,
            _id: unit._id ? common.encodeId(unit._id) : unit._id,
          })),
        }))
      : size.measurements,
  };
};

const getSizes = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedSizeIds = req.companyMasterData?.allowedSizes || [];

    const result = await sizeMasterService.fetchSizesForVendor(vendorId, allowedSizeIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.map(formatSizeForResponse));
  } catch (error) {
    logger.logException('Error fetching sizes', { error });
  }
};

module.exports = {
  getSizes,
};