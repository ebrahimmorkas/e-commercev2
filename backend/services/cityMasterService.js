const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const CITIES_CACHE_TTL = 3600;

// Shapes a raw CityMaster doc, dropping audit fields
const shapeCity = (city) => ({
  _id: city._id,
  city_name: city.city_name,
  short_city_name: city.short_city_name,
  state_id: city.state_id,
});

const fetchCitiesForVendor = async (vendorId, allowedCountryIds) => {
  try {
    logger.logInfo(null, null, 'Fetching cities for vendor', { vendorId });

    if (!Array.isArray(allowedCountryIds) || allowedCountryIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed countries configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No cities allowed for this vendor', []);
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

      // Step 2: Fetch active states belonging to those active countries
      const activeStates = await StateMaster.find({
        country_id: { $in: activeCountryIds },
        status: 'A',
      })
        .select('state_name short_state_name country_id')
        .lean();

      if (!activeStates || activeStates.length === 0) {
        return [];
      }

      const activeStateIds = activeStates.map((state) => state._id);

      // Step 3: Fetch active cities belonging to those active states
      const cities = await CityMaster.find({
        state_id: { $in: activeStateIds },
        status: 'A',
      })
        .select('city_name short_city_name state_id status')
        .lean();

      // Step 4: Build country -> states -> cities nested structure
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

      const stateMap = new Map(
        activeStates.map((state) => [
          state._id.toString(),
          {
            stateId: state._id,
            state_name: state.state_name,
            short_state_name: state.short_state_name,
            cities: [],
            countryId: state.country_id,
          },
        ])
      );

      cities.forEach((city) => {
        const stateGroup = stateMap.get(city.state_id.toString());
        if (stateGroup) {
          stateGroup.cities.push(shapeCity(city));
        }
      });

      // Attach non-empty state groups to their parent country group
      stateMap.forEach((stateGroup) => {
        if (stateGroup.cities.length === 0) return;

        const countryGroup = countryMap.get(stateGroup.countryId.toString());
        if (countryGroup) {
          countryGroup.states.push({
            stateId: stateGroup.stateId,
            state_name: stateGroup.state_name,
            short_state_name: stateGroup.short_state_name,
            cities: stateGroup.cities,
          });
        }
      });

      // Only return countries that have at least one state with cities
      return Array.from(countryMap.values()).filter((group) => group.states.length > 0);
    };

    const citiesData = await redisService.getOrSet(
      redisKeys.cities(vendorId),
      fetchFromDB,
      CITIES_CACHE_TTL
    );

    if (!citiesData || citiesData.length === 0) {
      logger.logInfo(0, 1, 'No cities found for vendor', { vendorId });
      return common.returnResult(true, 200, 'No cities found for this vendor', []);
    }

    logger.logInfo(1, 0, 'Cities fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'Cities fetched successfully', citiesData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchCitiesForVendor,
};