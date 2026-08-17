const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const STATES_CACHE_TTL = 3600;

// Shapes a raw StateMaster doc, dropping audit fields
const shapeState = (state) => ({
  _id: state._id,
  state_name: state.state_name,
  short_state_name: state.short_state_name,
  state_code: state.state_code,
  country_id: state.country_id,
});

const fetchStatesForVendor = async (vendorId, allowedCountryIds) => {
  try {
    logger.logInfo(null, null, 'Fetching states for vendor', { vendorId });

    if (!Array.isArray(allowedCountryIds) || allowedCountryIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed countries configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No states allowed for this vendor', []);
    }

    const fetchFromDB = async () => {
      // Step 1: Resolve allowedCountries down to only currently active countries
      const activeCountries = await CountryMaster.find({
        _id: { $in: allowedCountryIds },
        status: 'A',
      })
        .select('country_name short_country_name')
        .lean();

      if (!activeCountries || activeCountries.length === 0) {
        return [];
      }

      const activeCountryIds = activeCountries.map((country) => country._id);

      // Step 2: Fetch states only for those active, allowed countries
      const states = await StateMaster.find({
        country_id: { $in: activeCountryIds },
        status: 'A',
      })
        .select('state_name short_state_name state_code country_id status')
        .lean();

      // Step 3: Group states under their country
      const countryMap = new Map(
        activeCountries.map((country) => [
          country._id.toString(),
          {
            countryId: country._id,
            country_name: country.country_name,
            short_country_name: country.short_country_name,
            states: [],
          },
        ])
      );

      states.forEach((state) => {
        const group = countryMap.get(state.country_id.toString());
        if (group) {
          group.states.push(shapeState(state));
        }
      });

      // Only return countries that actually have at least one active state
      return Array.from(countryMap.values()).filter((group) => group.states.length > 0);
    };

    const statesData = await redisService.getOrSet(
      redisKeys.states(vendorId),
      fetchFromDB,
      STATES_CACHE_TTL
    );

    if (!statesData || statesData.length === 0) {
      logger.logInfo(0, 1, 'No states found for vendor', { vendorId });
      return common.returnResult(true, 200, 'No states found for this vendor', []);
    }

    logger.logInfo(1, 0, 'States fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'States fetched successfully', statesData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchStatesForVendor,
};