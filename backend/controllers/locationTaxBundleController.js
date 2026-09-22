const locationTaxBundleService = require('../services/locationTaxBundleService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Same encoding rules as countryMasterController/stateMasterController/
// cityMasterController/taxMasterController - this bundle just returns all
// four shapes together, so it re-applies each one's field set here. Encoding
// stays at this controller boundary, so the Redis-cached payload is unaffected.
const formatCountry = (country) => ({
  ...country,
  _id: country._id ? common.encodeId(country._id) : country._id,
  currency_id: country.currency_id ? common.encodeId(country.currency_id) : country.currency_id,
});

const formatCountryStateGroups = (groups) =>
  (groups || []).map((group) => ({
    ...group,
    countryId: group.countryId ? common.encodeId(group.countryId) : group.countryId,
    states: (group.states || []).map((state) => ({
      ...state,
      _id: state._id ? common.encodeId(state._id) : state._id,
      country_id: state.country_id ? common.encodeId(state.country_id) : state.country_id,
    })),
  }));

const formatCountryStateCityGroups = (groups) =>
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

const formatTax = (tax) => ({
  ...tax,
  _id: tax._id ? common.encodeId(tax._id) : tax._id,
  countryId: tax.countryId ? common.encodeId(tax.countryId) : tax.countryId,
  stateId: tax.stateId ? common.encodeId(tax.stateId) : tax.stateId,
});

const formatCountryTaxGroups = (groups) =>
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

const formatBundleForResponse = (bundle) => ({
  countries: (bundle?.countries || []).map(formatCountry),
  states: formatCountryStateGroups(bundle?.states),
  cities: formatCountryStateCityGroups(bundle?.cities),
  taxes: formatCountryTaxGroups(bundle?.taxes),
});

const getLocationTaxBundle = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const allowedCountryIds = req.companyMasterData?.allowedCountries || [];

    const result = await locationTaxBundleService.fetchLocationTaxBundleForVendor(vendorId, allowedCountryIds);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatBundleForResponse(result.meta));
  } catch (error) {
    logger.logException('Error fetching location and tax bundle', { error });
  }
};

module.exports = {
  getLocationTaxBundle,
};