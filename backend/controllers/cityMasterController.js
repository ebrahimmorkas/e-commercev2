const cityMasterService = require('../services/cityMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// result.meta is grouped [{ countryId, ..., states: [{ stateId, ...,
// cities: [{ _id, ..., state_id }] }] }] - encoding stays at this
// controller boundary, same as every other module, so the Redis-cached
// payload itself is unaffected.
const formatCountryStateCityGroupsForResponse = (groups) =>
  (groups || []).map((countryGroup) => ({
    ...countryGroup,
    countryId: countryGroup.countryId ? common.encodeId(countryGroup.countryId) : countryGroup.countryId,
    states: (countryGroup.states || []).map((stateGroup) => ({
      ...stateGroup,
      stateId: stateGroup.stateId ? common.encodeId(stateGroup.stateId) : stateGroup.stateId,
      cities: (stateGroup.cities || []).map((city) => ({
        ...city,
        _id: city._id ? common.encodeId(city._id) : city._id,
        state_id: city.state_id ? common.encodeId(city.state_id) : city.state_id,
      })),
    })),
  }));

const getCities = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await cityMasterService.fetchCitiesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatCountryStateCityGroupsForResponse(result.meta));
  } catch (error) {
    logger.logException('Error fetching cities', { error });
  }
};

module.exports = {
  getCities,
};