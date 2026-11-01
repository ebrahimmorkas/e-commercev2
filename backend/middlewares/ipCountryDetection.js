const currencyService = require('../services/currencyService');
const ipCountryService = require('../services/ipCountryService');
const logger = require('../utils/logger');

// Sets req.ipCountryId - the CountryMaster _id of the visitor's IP country -
// while isIPDetectionFeatureOn is on (WebsiteMaster AND CompanyMaster), else
// null. Only a fallback: wherever the customer's country is already known
// (Country cookie / their account), that wins. Used for currency and
// international pricing so a visitor gets them without logging in first.
// Must run after ensureVendorDataCached. Never blocks a request - a failed
// lookup just leaves the country unknown.
const ipCountryDetection = async (req, res, next) => {
    req.ipCountryId = null;
    try {
        if (req.companyMasterData && await currencyService.isIPDetectionOn(req.companyMasterData, req.websiteMasterData)) {
            req.ipCountryId = await ipCountryService.lookupCountryId(req.ip);
        }
    } catch (error) {
        logger.logWarning('ipCountryDetection: IP country lookup failed - country left unknown', { error });
    }
    next();
};

module.exports = ipCountryDetection;
