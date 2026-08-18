const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const TaxMaster = require('../models/TaxMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const BUNDLE_CACHE_TTL = 3600;

const shapeCountry = (country) => ({
  _id: country._id,
  country_name: country.country_name,
  short_country_name: country.short_country_name,
  country_code: country.country_code,
  phone_code: country.phone_code,
  currency_id: country.currency_id,
});

const shapeState = (state) => ({
  _id: state._id,
  state_name: state.state_name,
  short_state_name: state.short_state_name,
  state_code: state.state_code,
  country_id: state.country_id,
});

const shapeCity = (city) => ({
  _id: city._id,
  city_name: city.city_name,
  short_city_name: city.short_city_name,
  state_id: city.state_id,
});

const shapeTax = (tax) => ({
  _id: tax._id,
  name: tax.name,
  code: tax.code,
  countryId: tax.countryId,
  stateId: tax.stateId,
  hsnCode: tax.hsnCode,
  sacCode: tax.sacCode,
  taxType: tax.taxType,
  totalRate: tax.totalRate,
  components: tax.components,
  priceType: tax.priceType,
  applicableFrom: tax.applicableFrom,
  applicableTo: tax.applicableTo,
  isDefault: tax.isDefault,
  precedence: tax.precedence,
});

const fetchLocationTaxBundleForVendor = async (vendorId, allowedCountryIds) => {
  try {
    logger.logInfo(null, null, 'Fetching location + tax bundle for vendor', { vendorId });

    const emptyBundle = { countries: [], states: [], cities: [], taxes: [] };

    if (!Array.isArray(allowedCountryIds) || allowedCountryIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed countries configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No countries allowed for this vendor', emptyBundle);
    }

    const fetchFromDB = async () => {
      // Step 1: Active countries (shared base for everything below)
      const activeCountries = await CountryMaster.find({
        _id: { $in: allowedCountryIds },
        status: 'A',
      })
        .select('country_name short_country_name country_code phone_code currency_id')
        .lean();

      if (!activeCountries || activeCountries.length === 0) {
        return emptyBundle;
      }

      const activeCountryIds = activeCountries.map((country) => country._id);

      // Step 2: Active states for those countries (shared by states/cities)
      const activeStates = await StateMaster.find({
        country_id: { $in: activeCountryIds },
        status: 'A',
      })
        .select('state_name short_state_name state_code country_id')
        .lean();

      const activeStateIds = activeStates.map((state) => state._id);

      // Step 3: Active cities for those states
      const cities = activeStateIds.length
        ? await CityMaster.find({
            state_id: { $in: activeStateIds },
            status: 'A',
          })
            .select('city_name short_city_name state_id')
            .lean()
        : [];

      // Step 4: Currently-valid, active taxes for those countries
      const now = new Date();
      const taxes = await TaxMaster.find({
        countryId: { $in: activeCountryIds },
        status: 'A',
        applicableFrom: { $lte: now },
        $or: [{ applicableTo: null }, { applicableTo: { $gte: now } }],
      }).lean();

      // --- Assemble: countries (flat) ---
      const countriesOut = activeCountries.map(shapeCountry);

      // --- Assemble: states grouped by country ---
      const countryStateMap = new Map(
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
      activeStates.forEach((state) => {
        const group = countryStateMap.get(state.country_id.toString());
        if (group) group.states.push(shapeState(state));
      });
      const statesOut = Array.from(countryStateMap.values()).filter(
        (group) => group.states.length > 0
      );

      // --- Assemble: cities nested country -> state -> cities ---
      const countryCityMap = new Map(
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
      const stateCityGroupMap = new Map(
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
        const stateGroup = stateCityGroupMap.get(city.state_id.toString());
        if (stateGroup) stateGroup.cities.push(shapeCity(city));
      });
      stateCityGroupMap.forEach((stateGroup) => {
        if (stateGroup.cities.length === 0) return;
        const countryGroup = countryCityMap.get(stateGroup.countryId.toString());
        if (countryGroup) {
          countryGroup.states.push({
            stateId: stateGroup.stateId,
            state_name: stateGroup.state_name,
            short_state_name: stateGroup.short_state_name,
            cities: stateGroup.cities,
          });
        }
      });
      const citiesOut = Array.from(countryCityMap.values()).filter(
        (group) => group.states.length > 0
      );

      // --- Assemble: taxes grouped country -> { taxes, states -> taxes } ---
      const stateNameMap = new Map(
        activeStates.map((state) => [state._id.toString(), state.state_name])
      );
      const countryTaxMap = new Map(
        activeCountries.map((country) => [
          country._id.toString(),
          {
            countryId: country._id,
            country_name: country.country_name,
            short_country_name: country.short_country_name,
            taxes: [],
            states: [],
          },
        ])
      );
      const stateTaxGroupMap = new Map(); // key: `${countryId}_${stateId}`
      taxes.forEach((tax) => {
        const countryGroup = countryTaxMap.get(tax.countryId.toString());
        if (!countryGroup) return;

        const shaped = shapeTax(tax);

        if (!tax.stateId) {
          countryGroup.taxes.push(shaped);
          return;
        }

        const stateKey = `${tax.countryId.toString()}_${tax.stateId.toString()}`;
        let stateGroup = stateTaxGroupMap.get(stateKey);
        if (!stateGroup) {
          stateGroup = {
            stateId: tax.stateId,
            state_name: stateNameMap.get(tax.stateId.toString()) || null,
            taxes: [],
          };
          stateTaxGroupMap.set(stateKey, stateGroup);
          countryGroup.states.push(stateGroup);
        }
        stateGroup.taxes.push(shaped);
      });
      const taxesOut = Array.from(countryTaxMap.values()).filter(
        (group) => group.taxes.length > 0 || group.states.length > 0
      );

      return {
        countries: countriesOut,
        states: statesOut,
        cities: citiesOut,
        taxes: taxesOut,
      };
    };

    const bundleData = await redisService.getOrSet(
      redisKeys.locationTaxBundle(vendorId),
      fetchFromDB,
      BUNDLE_CACHE_TTL
    );

    logger.logInfo(1, 0, 'Location + tax bundle fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'Location and tax data fetched successfully', bundleData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchLocationTaxBundleForVendor,
};