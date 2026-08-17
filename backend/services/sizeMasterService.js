const SizeMaster = require('../models/SizeMaster');
require('../models/UnitMaster'); // ensures UnitMaster schema is registered for populate
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const SIZES_CACHE_TTL = 3600;

// Shapes a raw SizeMaster doc into the response format.
// LABEL sizes expose `values`. MEASURABLE sizes expose `measurements`
// with each measurement's `allowedUnits` populated (active units only).
const shapeSize = (size) => {
  const shaped = {
    _id: size._id,
    name: size.name,
    type: size.type,
  };

  if (size.type === 'LABEL') {
    shaped.values = size.values || [];
  } else if (size.type === 'MEASURABLE') {
    shaped.measurements = (size.measurements || []).map((measurement) => ({
      label: measurement.label,
      allowedUnits: (measurement.allowedUnits || []).map((unit) => ({
        _id: unit._id,
        name: unit.name,
      })),
    }));
  }

  return shaped;
};

const fetchSizesForVendor = async (vendorId, allowedSizeIds) => {
  try {
    logger.logInfo(null, null, 'Fetching sizes for vendor', { vendorId });

    if (!Array.isArray(allowedSizeIds) || allowedSizeIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed sizes configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No sizes allowed for this vendor', []);
    }

    const fetchFromDB = async () => {
      const sizes = await SizeMaster.find({
        _id: { $in: allowedSizeIds },
        status: 'A',
      })
        .populate({
          path: 'measurements.allowedUnits',
          match: { status: 'A' },
          select: 'name status',
        })
        .lean();

      return sizes.map(shapeSize);
    };

    const sizesData = await redisService.getOrSet(
      redisKeys.sizes(vendorId),
      fetchFromDB,
      SIZES_CACHE_TTL
    );

    if (!sizesData || sizesData.length === 0) {
      logger.logInfo(0, 1, 'No sizes found for vendor', { vendorId });
      return common.returnResult(true, 200, 'No sizes found for this vendor', []);
    }

    logger.logInfo(1, 0, 'Sizes fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'Sizes fetched successfully', sizesData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchSizesForVendor,
};