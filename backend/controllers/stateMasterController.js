const stateMasterService = require('../services/stateMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// result.meta is grouped [{ countryId, country_name, ..., states: [{ _id,
// ..., country_id }] }] - encoding stays at this controller boundary, same
// as every other module, so the Redis-cached payload itself is unaffected.
const formatCountryStateGroupsForResponse = (groups) =>
  (groups || []).map((group) => ({
    ...group,
    countryId: group.countryId ? common.encodeId(group.countryId) : group.countryId,
    states: (group.states || []).map((state) => ({
      ...state,
      _id: state._id ? common.encodeId(state._id) : state._id,
      country_id: state.country_id ? common.encodeId(state.country_id) : state.country_id,
    })),
  }));

const getStates = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await stateMasterService.fetchStatesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatCountryStateGroupsForResponse(result.meta));
  } catch (error) {
    logger.logException('Error fetching states', { error });
  }
};

module.exports = {
  getStates,
};