const geoip = require('geoip-country');
const CountryMaster = require('../models/CountryMaster');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');

// Offline IP -> country lookup (geoip-country: MaxMind GeoLite2 data bundled
// in the package - no external call, no API key). Update the package now and
// then to refresh the data.

const COUNTRY_BY_ISO_TTL_SECONDS = 24 * 60 * 60;

// Local requests (127.0.0.1, ::1, 192.168.x) have no country. Outside
// production IP_DETECTION_TEST_IP stands in for the visitor's IP, so IP
// detection can be tried on localhost (e.g. 8.8.8.8 = United States).
const resolveLookupIp = (ip) => {
    try {
        if (process.env.NODE_ENV !== 'production' && process.env.IP_DETECTION_TEST_IP) {
            return process.env.IP_DETECTION_TEST_IP.trim();
        }
        // IPv4 clients reach a dual-stack server as ::ffff:1.2.3.4
        return String(ip || '').replace(/^::ffff:/i, '');
    } catch (err) {
        throw err;
    }
};

// CountryMaster _id (string) for an ISO 3166-1 alpha-2 code, cached. A code
// with no active CountryMaster is cached too ({ countryId: null }), so
// visitors from countries the platform hasn't added don't hit the DB on
// every request.
const findCountryIdByIsoCode = async (isoCode) => {
    try {
        const cached = await redisService.getOrSet(
            redisKeys.countryByIsoCode(isoCode),
            async () => {
                const country = await CountryMaster.findOne({ short_country_name: isoCode, status: 'A' }).select('_id').lean();
                return { countryId: country ? country._id.toString() : null };
            },
            COUNTRY_BY_ISO_TTL_SECONDS
        );
        return cached?.countryId || null;
    } catch (err) {
        throw err;
    }
};

// A visitor from a country the platform hasn't added to CountryMaster still
// has a known country - just no _id. It travels as "ISO:<code>" in place of a
// country id: nothing matches it as a served country (it is never an
// ObjectId), but international pricing can still tell it isn't the store
// country (currencyService).
const UNLISTED_COUNTRY_PREFIX = 'ISO:';

const toUnlistedCountryKey = (isoCode) => `${UNLISTED_COUNTRY_PREFIX}${isoCode}`;

// The ISO code inside an unlisted-country key, else null.
const parseUnlistedCountryKey = (countryKey) => {
    try {
        const text = String(countryKey || '');
        return text.startsWith(UNLISTED_COUNTRY_PREFIX) ? text.slice(UNLISTED_COUNTRY_PREFIX.length) : null;
    } catch (err) {
        throw err;
    }
};

// The visitor's country from their IP: the CountryMaster _id (string), an
// unlisted-country key for a country not in CountryMaster, or null.
const lookupCountryId = async (ip) => {
    try {
        const lookupIp = resolveLookupIp(ip);
        if (!lookupIp) return null;
        const isoCode = geoip.lookup(lookupIp)?.country;
        if (!isoCode) return null;
        const upperIsoCode = isoCode.toUpperCase();
        const countryId = await findCountryIdByIsoCode(upperIsoCode);
        return countryId || toUnlistedCountryKey(upperIsoCode);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    lookupCountryId,
    parseUnlistedCountryKey
};
