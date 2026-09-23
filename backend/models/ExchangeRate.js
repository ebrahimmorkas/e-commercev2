const mongoose = require('mongoose');

// Cached exchange-rate table for one base currency (e.g. every rate FROM INR),
// written only by services/exchangeRateService.js from the configured provider.
// Global master data like CurrencyMaster/CountryMaster: rates are the same for
// every vendor, so there is one document per base currency, not per vendor.
const exchangeRateSchema = new mongoose.Schema({
    baseCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        unique: true
    },
    // Target currency code -> units of that currency per 1 unit of baseCode.
    rates: {
        type: Map,
        of: Number,
        default: {}
    },
    provider: {
        type: String,
        required: true
    },
    // When we last fetched successfully (freshness is judged from this).
    fetchedAt: {
        type: Date,
        required: true
    },
    // The provider's own "last updated" time for these rates, when it reports one.
    providerUpdatedAt: {
        type: Date,
        default: null
    },
    lastError: {
        type: String,
        default: null
    },
    lastErrorAt: {
        type: Date,
        default: null
    },

    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
