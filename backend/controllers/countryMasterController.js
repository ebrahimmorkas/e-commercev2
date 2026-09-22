const countryMasterService = require('../services/countryMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// The service (shapeCountry) shapes and caches raw ids in Redis - encoding
// stays at this controller boundary only, same as every other module, so
// the cached payload itself is unaffected by this.
const formatCountryForResponse = (country) => {
  if (!country) return country;
  return {
    ...country,
    _id: country._id ? common.encodeId(country._id) : country._id,
    currency_id: country.currency_id ? common.encodeId(country.currency_id) : country.currency_id,
  };
};

const getCountries = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await countryMasterService.fetchCountriesForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.map(formatCountryForResponse));
  } catch (error) {
    logger.logException('Error fetching countries', { error });
  }
};

module.exports = {
  getCountries,
};