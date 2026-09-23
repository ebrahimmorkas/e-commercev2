const ExchangeRate = require('../models/ExchangeRate');
const logger = require('../utils/logger');
const { getExchangeRateProvider } = require('./providers/exchangeRate/exchangeRateProviderFactory');

// Rates are re-fetched once the cached table is older than this...
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
// ...and only used while younger than this. An older table (the provider has
// been failing for a day and a half) counts as "no fresh rate": customers are
// then shown the store currency instead of a stale conversion.
const FRESH_FOR_MS = 36 * 60 * 60 * 1000;

// One refresh per base currency at a time, however many requests arrive.
const inFlightRefreshes = new Map();

const refreshRates = async (baseCode, existing) => {
    try {
        const provider = getExchangeRateProvider();
        try {
            const { rates, providerUpdatedAt } = await provider.fetchRates(baseCode);
            return await ExchangeRate.findOneAndUpdate(
                { baseCode },
                { $set: { rates, provider: provider.name, fetchedAt: new Date(), providerUpdatedAt, lastError: null, lastErrorAt: null, status: 'A' } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (fetchErr) {
            // Keep serving the last good table (if any) - only its age decides whether it's still used.
            logger.logWarning('exchangeRateService: rate refresh failed', { baseCode, error: fetchErr });
            if (existing) {
                await ExchangeRate.updateOne({ _id: existing._id }, { $set: { lastError: fetchErr.message, lastErrorAt: new Date() } });
            }
            return existing;
        }
    } catch (err) {
        throw err;
    }
};

// The cached rate table for a base currency, refreshed when due. Never throws
// for a provider failure - returns the last good table, or null if none.
const getRateTable = async (baseCode) => {
    try {
        const code = (baseCode || '').toUpperCase();
        if (!code) return null;

        const existing = await ExchangeRate.findOne({ baseCode: code, status: 'A' });
        const isDue = !existing || (Date.now() - existing.fetchedAt.getTime()) > REFRESH_AFTER_MS;
        if (!isDue) return existing;

        if (!inFlightRefreshes.has(code)) {
            inFlightRefreshes.set(code, refreshRates(code, existing).finally(() => inFlightRefreshes.delete(code)));
        }
        return await inFlightRefreshes.get(code);
    } catch (err) {
        throw err;
    }
};

/**
 * Units of targetCode per 1 unit of baseCode, from a FRESH table only.
 * @returns {Promise<{ rate: number, fetchedAt: Date|null } | null>} null = no fresh rate available.
 */
const getFreshRate = async (baseCode, targetCode) => {
    try {
        const base = (baseCode || '').toUpperCase();
        const target = (targetCode || '').toUpperCase();
        if (!base || !target) return null;
        if (base === target) return { rate: 1, fetchedAt: null };

        const table = await getRateTable(base);
        if (!table || (Date.now() - table.fetchedAt.getTime()) > FRESH_FOR_MS) return null;

        const rate = table.rates.get(target);
        if (typeof rate !== 'number' || !(rate > 0)) return null;
        return { rate, fetchedAt: table.fetchedAt };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getRateTable,
    getFreshRate
};
