const currencyService = require('../services/currencyService');
const userLocationService = require('../services/userLocationService');
const logger = require('../utils/logger');
const common = require('../utils/common');

// Storefront: the visitor's currency + the rate from the store currency. The
// country is the Country cookie (set from the account at login), else the
// logged-in user's own country; a guest with neither gets the store currency.
const getCurrencyContext = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const countryId = req.cookies?.Country || userLocationService.extractUserLocation(req.user).countryId;
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

// Admin: the store currency every admin screen shows amounts in.
const getStoreCurrency = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const storeCurrency = await currencyService.getStoreCurrency(req.companySettingsData);
        if (!storeCurrency) {
            return common.sendError(res, 404, 'Store currency is not configured. Set it in Company Settings.');
        }
        return common.sendSuccess(res, 200, 'Store currency fetched successfully', { currency: currencyService.shapeCurrency(storeCurrency) });
    } catch (error) {
        logger.logException('currencyController: getStoreCurrency - Exception while fetching store currency', { vendorId, error });
    }
};

// Admin: every active currency, for the Company Settings "Store currency" dropdown.
const getCurrencies = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await currencyService.fetchActiveCurrencies();
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
