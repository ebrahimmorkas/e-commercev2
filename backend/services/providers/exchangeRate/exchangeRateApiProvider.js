// ExchangeRate-API (https://www.exchangerate-api.com) - 160+ currencies, any
// base, rates refreshed daily from central-bank and market sources.
// Without EXCHANGE_RATE_API_KEY the free open endpoint is used (no signup,
// attribution to exchangerate-api.com appreciated); with a key, the keyed v6
// endpoint of your plan.
const OPEN_URL = 'https://open.er-api.com/v6/latest';
const KEYED_URL = 'https://v6.exchangerate-api.com/v6';
const REQUEST_TIMEOUT_MS = 10000;

const name = 'exchangerate-api';

/**
 * @param {string} baseCode - ISO 4217 code, e.g. 'INR'
 * @returns {Promise<{ rates: Object<string, number>, providerUpdatedAt: Date|null }>}
 */
const fetchRates = async (baseCode) => {
    try {
        const apiKey = process.env.EXCHANGE_RATE_API_KEY;
        const url = apiKey
            ? `${KEYED_URL}/${encodeURIComponent(apiKey)}/latest/${encodeURIComponent(baseCode)}`
            : `${OPEN_URL}/${encodeURIComponent(baseCode)}`;

        const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.result !== 'success') {
            throw new Error(`ExchangeRate-API request failed (${response.status}): ${payload?.['error-type'] || 'unknown error'}`);
        }

        // Open endpoint names the map "rates", the keyed one "conversion_rates".
        const rates = payload.rates || payload.conversion_rates;
        if (!rates || typeof rates !== 'object') {
            throw new Error('ExchangeRate-API returned no rates');
        }

        return {
            rates,
            providerUpdatedAt: payload.time_last_update_unix ? new Date(payload.time_last_update_unix * 1000) : null
        };
    } catch (err) {
        throw err;
    }
};

module.exports = { name, fetchRates };
