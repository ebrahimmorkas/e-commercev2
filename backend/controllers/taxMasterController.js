const taxMasterService = require('../services/taxMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// result.meta is grouped [{ countryId, ..., taxes: [{ _id, countryId,
// stateId, ... }], states: [{ stateId, ..., taxes: [...] }] }] - encoding
// stays at this controller boundary, same as every other module, so the
// Redis-cached payload itself is unaffected.
const formatTax = (tax) => ({
  ...tax,
  _id: tax._id ? common.encodeId(tax._id) : tax._id,
  countryId: tax.countryId ? common.encodeId(tax.countryId) : tax.countryId,
  stateId: tax.stateId ? common.encodeId(tax.stateId) : tax.stateId,
});

const formatCountryTaxGroupsForResponse = (groups) =>
  (groups || []).map((countryGroup) => ({
    ...countryGroup,
    countryId: countryGroup.countryId ? common.encodeId(countryGroup.countryId) : countryGroup.countryId,
    taxes: (countryGroup.taxes || []).map(formatTax),
    states: (countryGroup.states || []).map((stateGroup) => ({
      ...stateGroup,
      stateId: stateGroup.stateId ? common.encodeId(stateGroup.stateId) : stateGroup.stateId,
      taxes: (stateGroup.taxes || []).map(formatTax),
    })),
  }));

const getTaxes = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await taxMasterService.fetchTaxesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatCountryTaxGroupsForResponse(result.meta));
  } catch (error) {
    logger.logException('Error fetching taxes', { error });
  }
};

module.exports = {
  getTaxes,
};