// Exchange-rate providers, selected by EXCHANGE_RATE_PROVIDER (default
// 'exchangerate-api'). Interface: fetchRates(baseCode) ->
// Promise<{ rates: { [code]: number }, providerUpdatedAt: Date|null }>,
// where rates[code] = units of `code` per 1 unit of baseCode. Adding a
// provider = a new file with that shape + an entry below.
const exchangeRateApiProvider = require('./exchangeRateApiProvider');

const PROVIDERS = {
    [exchangeRateApiProvider.name]: exchangeRateApiProvider
};

const getExchangeRateProvider = () => {
    try {
        const key = (process.env.EXCHANGE_RATE_PROVIDER || exchangeRateApiProvider.name).toLowerCase();
        const provider = PROVIDERS[key];
        if (!provider) {
            throw new Error(`Unknown EXCHANGE_RATE_PROVIDER "${key}"`);
        }
        return provider;
    } catch (err) {
        throw err;
    }
};

module.exports = { getExchangeRateProvider };
