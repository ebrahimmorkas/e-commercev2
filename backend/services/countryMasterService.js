const CountryMaster = require('../models/CountryMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const COUNTRIES_CACHE_TTL = 3600;

// Shapes a raw CountryMaster doc into the vendor-facing response format,
// dropping audit fields (createdBy, updatedBy, deletedBy, activeMarkedBy, etc.)
const shapeCountry = (country) => ({
  _id: country._id,
  country_name: country.country_name,
  short_country_name: country.short_country_name,
  country_code: country.country_code,
  phone_code: country.phone_code,
  currency_id: country.currency_id,
});

const fetchCountriesForVendor = async (vendorId, allowedCountryIds) => {
  try {
    logger.logInfo(null, null, 'Fetching countries for vendor', { vendorId });

    if (!Array.isArray(allowedCountryIds) || allowedCountryIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed countries configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No countries allowed for this vendor', []);
    }

    const fetchFromDB = async () => {
      const countries = await CountryMaster.find({
        _id: { $in: allowedCountryIds },
        status: 'A',
      })
        .select('country_name short_country_name country_code phone_code currency_id status')
        .lean();

      return countries.map(shapeCountry);
    };

    const countriesData = await redisService.getOrSet(
      redisKeys.countries(vendorId),
      fetchFromDB,
      COUNTRIES_CACHE_TTL
    );

    if (!countriesData || countriesData.length === 0) {
      logger.logInfo(0, 1, 'No countries found for vendor', { vendorId });
      return common.returnResult(true, 200, 'No countries found for this vendor', []);
    }

    logger.logInfo(1, 0, 'Countries fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'Countries fetched successfully', countriesData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchCountriesForVendor,
};