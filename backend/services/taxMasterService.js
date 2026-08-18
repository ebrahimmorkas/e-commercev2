const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const TaxMaster = require('../models/TaxMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');

const TAXES_CACHE_TTL = 3600;

// Shapes a raw TaxMaster doc, dropping audit fields
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

const fetchTaxesForVendor = async (vendorId, allowedCountryIds) => {
  try {
    logger.logInfo(null, null, 'Fetching taxes for vendor', { vendorId });

    if (!Array.isArray(allowedCountryIds) || allowedCountryIds.length === 0) {
      logger.logInfo(1, 0, 'No allowed countries configured for vendor', { vendorId });
      return common.returnResult(true, 200, 'No taxes allowed for this vendor', []);
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
      const now = new Date();

      // Step 2: Fetch active, currently-valid taxes for those countries
      const taxes = await TaxMaster.find({
        countryId: { $in: activeCountryIds },
        status: 'A',
        applicableFrom: { $lte: now },
        $or: [
          { applicableTo: null },
          { applicableTo: { $gte: now } },
        ],
      }).lean();

      if (!taxes || taxes.length === 0) {
        return [];
      }

      // Step 3: Resolve state names for state-specific taxes (no allowedStates
      // check per instruction — country allow-list is the only gate)
      const stateIds = taxes
        .filter((tax) => tax.stateId)
        .map((tax) => tax.stateId);

      const states = stateIds.length
        ? await StateMaster.find({ _id: { $in: stateIds } })
            .select('state_name')
            .lean()
        : [];

      const stateNameMap = new Map(
        states.map((state) => [state._id.toString(), state.state_name])
      );

      // Step 4: Build country -> { taxes (country-wide), states -> taxes } structure
      const countryMap = new Map(
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

      // stateId -> { stateId, state_name, taxes: [] }, scoped per country
      const stateGroupMap = new Map(); // key: `${countryId}_${stateId}`

      taxes.forEach((tax) => {
        const countryGroup = countryMap.get(tax.countryId.toString());
        if (!countryGroup) return;

        const shaped = shapeTax(tax);

        if (!tax.stateId) {
          countryGroup.taxes.push(shaped);
          return;
        }

        const stateKey = `${tax.countryId.toString()}_${tax.stateId.toString()}`;
        let stateGroup = stateGroupMap.get(stateKey);

        if (!stateGroup) {
          stateGroup = {
            stateId: tax.stateId,
            state_name: stateNameMap.get(tax.stateId.toString()) || null,
            taxes: [],
          };
          stateGroupMap.set(stateKey, stateGroup);
          countryGroup.states.push(stateGroup);
        }

        stateGroup.taxes.push(shaped);
      });

      // Only keep countries that have at least one tax (country-wide or state-specific)
      return Array.from(countryMap.values()).filter(
        (group) => group.taxes.length > 0 || group.states.length > 0
      );
    };

    const taxesData = await redisService.getOrSet(
      redisKeys.taxes(vendorId),
      fetchFromDB,
      TAXES_CACHE_TTL
    );

    if (!taxesData || taxesData.length === 0) {
      logger.logInfo(0, 1, 'No taxes found for vendor', { vendorId });
      return common.returnResult(true, 200, 'No taxes found for this vendor', []);
    }

    logger.logInfo(1, 0, 'Taxes fetched successfully for vendor', { vendorId });
    return common.returnResult(true, 200, 'Taxes fetched successfully', taxesData);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  fetchTaxesForVendor,
};