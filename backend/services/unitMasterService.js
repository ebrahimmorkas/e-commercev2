const UnitMaster = require('../models/UnitMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const UNITS_CACHE_TTL = 3600;

const fetchAllUnits = async () => {
  try {
    logger.logInfo(null, null, 'Fetching all units from DB');

    const fetchFromDB = async () => {
      const units = await UnitMaster.find({ status: 'A' })
        .select('name status')
        .lean();
      return units;
    };

    const unitsData = await redisService.getOrSet(
      redisKeys.units(),
      fetchFromDB,
      UNITS_CACHE_TTL
    );

    if (!unitsData || unitsData.length === 0) {
      logger.logInfo(0, 1, 'No units found');
      return common.returnResult(true, 200, 'No units found', []);
    }

    logger.logInfo(1, 0, 'Units fetched successfully');
    return common.returnResult(true, 200, 'Units fetched successfully', unitsData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchAllUnits,
};