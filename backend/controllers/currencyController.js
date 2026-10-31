const currencyService = require('../services/currencyService');
const userLocationService = require('../services/userLocationService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Storefront: the visitor's currency + the rate from the store currency. The
// country is the Country cookie (set from the account at login), else the
// logged-in user's own country, else (IP detection on) their IP country; a
// guest with none of these gets the store currency.
const getCurrencyContext = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const countryId = req.cookies?.Country || userLocationService.extractUserLocation(req.user).countryId || req.ipCountryId || null;
        const result = await currencyService.fetchCurrencyContext({
            countryId,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData
        });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('currencyController: getCurrencyContext - Exception while resolving currency', { vendorId, error });
    }
};

// Admin: the store currency every admin screen shows amounts in, plus the
// international currency while international pricing is on (null otherwise).
const getStoreCurrency = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const storeCurrency = await currencyService.getStoreCurrency(req.companySettingsData);
        if (!storeCurrency) {
            return common.sendError(res, 404, 'Store currency is not configured. Set it in Company Settings.');
        }
        const internationalCurrency = await currencyService.fetchActiveInternationalCurrency({
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData
        });
        return common.sendSuccess(res, 200, 'Store currency fetched successfully', {
            currency: currencyService.shapeCurrency(storeCurrency),
            internationalCurrency
        });
    } catch (error) {
        logger.logException('currencyController: getStoreCurrency - Exception while fetching store currency', { vendorId, error });
    }
};

// Admin: the currencies of the vendor's assigned countries, for the Company Settings "Store currency" dropdown.
const getCurrencies = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const allowedCountryIds = req.companyMasterData?.allowedCountries || [];
        const result = await currencyService.fetchCurrenciesForVendor(allowedCountryIds);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            currencies: result.meta.currencies.map((currency) => ({ ...currency, _id: common.encodeId(currency._id) }))
        });
    } catch (error) {
        logger.logException('currencyController: getCurrencies - Exception while fetching currencies', { vendorId, error });
    }
};

module.exports = {
    getCurrencyContext,
    getStoreCurrency,
    getCurrencies
};
