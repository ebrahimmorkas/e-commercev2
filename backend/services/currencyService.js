const mongoose = require('mongoose');
const CurrencyMaster = require('../models/CurrencyMaster');
const CountryMaster = require('../models/CountryMaster');
const common = require('../utils/common');
const exchangeRateService = require('./exchangeRateService');

/*
|--------------------------------------------------------------------------
| CURRENCY RULES (confirmed by the vendor owner)
|--------------------------------------------------------------------------
| - Every price the vendor enters (products, shipping, discounts, free cash)
|   is in the STORE currency: CompanySettings.currencyId.
| - A customer sees - and a storefront order is charged in - the currency of
|   their own country (the Country cookie set from their account), converted
|   at the provider's exchange rate. Only when that country is one of
|   CompanyMaster.allowedCountries, it has a currency, and a FRESH rate exists;
|   otherwise the store currency (no conversion).
| - Guests without a Country cookie see the store currency.
*/

const isObjectId = (value) => !!value && mongoose.Types.ObjectId.isValid(value);

// The formatting fields the frontend/backend messages need - no ids.
const shapeCurrency = (currency) => {
    try {
        if (!currency) return null;
        return {
            code: currency.short_name,
            name: currency.name,
            symbol: currency.symbol,
            symbolPosition: currency.symbol_position || 'PREFIX',
            decimalPlaces: typeof currency.decimal_places === 'number' ? currency.decimal_places : 2
        };
    } catch (err) {
        throw err;
    }
};

const getStoreCurrency = async (companySettingsData) => {
    try {
        if (!companySettingsData?.currencyId) return null;
        return await CurrencyMaster.findOne({ _id: companySettingsData.currencyId, status: 'A' }).lean();
    } catch (err) {
        throw err;
    }
};

// A country's currency: CountryMaster.currency_id, else a CurrencyMaster
// pointing at that country (both links exist in the schema).
const getCountryCurrency = async (countryId) => {
    try {
        if (!isObjectId(countryId)) return null;
        const country = await CountryMaster.findOne({ _id: countryId, status: 'A' }).select('currency_id').lean();
        if (!country) return null;
        if (country.currency_id) {
            const linked = await CurrencyMaster.findOne({ _id: country.currency_id, status: 'A' }).lean();
            if (linked) return linked;
        }
        return await CurrencyMaster.findOne({ country_id: countryId, status: 'A' }).lean();
    } catch (err) {
        throw err;
    }
};

/**
 * Which currency a customer from `countryId` sees and pays in.
 * @returns returnResult - meta: { storeCurrency, currency, exchangeRate, rateFetchedAt, isConverted }
 *   (storeCurrency/currency are CurrencyMaster docs; exchangeRate = currency units per 1 store unit).
 */
const resolveCustomerCurrency = async ({ countryId, companyMasterData, companySettingsData }) => {
    try {
        const storeCurrency = await getStoreCurrency(companySettingsData);
        if (!storeCurrency) {
            return common.returnResult(false, 500, 'Store currency is not configured. Please contact support.');
        }
        const storeResult = { storeCurrency, currency: storeCurrency, exchangeRate: 1, rateFetchedAt: null, isConverted: false };

        const allowedCountryIds = (companyMasterData?.allowedCountries || []).map((id) => id.toString());
        if (!isObjectId(countryId) || !allowedCountryIds.includes(countryId.toString())) {
            return common.returnResult(true, 200, 'Store currency', storeResult);
        }

        const countryCurrency = await getCountryCurrency(countryId);
        if (!countryCurrency || countryCurrency.short_name === storeCurrency.short_name) {
            return common.returnResult(true, 200, 'Store currency', storeResult);
        }

        const fresh = await exchangeRateService.getFreshRate(storeCurrency.short_name, countryCurrency.short_name);
        if (!fresh) {
            return common.returnResult(true, 200, 'No fresh exchange rate - store currency', storeResult);
        }

        return common.returnResult(true, 200, 'Customer currency', {
            storeCurrency,
            currency: countryCurrency,
            exchangeRate: fresh.rate,
            rateFetchedAt: fresh.fetchedAt,
            isConverted: true
        });
    } catch (err) {
        throw err;
    }
};

// Store-currency amount -> customer-currency amount, rounded to that currency's decimals.
const convertAmount = (amount, exchangeRate, decimalPlaces = 2) => {
    try {
        const factor = 10 ** decimalPlaces;
        return Math.round((Number(amount) || 0) * (exchangeRate || 1) * factor) / factor;
    } catch (err) {
        throw err;
    }
};

/**
 * Converts priced order lines (store currency) into the order currency, in
 * place: unitPrice first, then amount = unitPrice x quantity (so a line always
 * multiplies out exactly), then each tax entry. A rate of 1 changes nothing.
 * @param {Array<{ unitPrice, quantity, amount, taxBreakdown? }>} lines
 */
const convertLines = (lines, exchangeRate, decimalPlaces = 2) => {
    try {
        if (!exchangeRate || exchangeRate === 1) return lines;
        const factor = 10 ** decimalPlaces;
        for (const line of lines) {
            line.unitPrice = convertAmount(line.unitPrice, exchangeRate, decimalPlaces);
            line.amount = Math.round(line.unitPrice * line.quantity * factor) / factor;
            (line.taxBreakdown || []).forEach((tax) => {
                tax.taxAmount = convertAmount(tax.taxAmount, exchangeRate, decimalPlaces);
            });
        }
        return lines;
    } catch (err) {
        throw err;
    }
};

// The currency fields every Order carries (see models/Order.js).
const buildOrderCurrencyFields = (currencyMeta) => {
    try {
        const { currency, storeCurrency, exchangeRate } = currencyMeta;
        return {
            currencyId: currency._id,
            currencyCode: currency.short_name,
            currencySymbol: currency.symbol,
            currencySymbolPosition: currency.symbol_position,
            currencyDecimalPlaces: typeof currency.decimal_places === 'number' ? currency.decimal_places : 2,
            exchangeRate: exchangeRate || 1,
            storeCurrencyCode: storeCurrency.short_name
        };
    } catch (err) {
        throw err;
    }
};

// "₹499.00" / "19.16 AED" style text for backend messages (shaped currency).
const formatAmount = (amount, shapedCurrency) => {
    try {
        if (!shapedCurrency) return String(amount);
        const value = (Number(amount) || 0).toFixed(shapedCurrency.decimalPlaces);
        return shapedCurrency.symbolPosition === 'SUFFIX' ? `${value} ${shapedCurrency.symbol}` : `${shapedCurrency.symbol}${value}`;
    } catch (err) {
        throw err;
    }
};

/**
 * Turns a store-currency amount into display text in the customer's currency -
 * what backend messages like "Add items worth X more" use.
 * @returns {(storeAmount: number) => string}
 */
const buildMoneyFormatter = (currencyMeta) => {
    try {
        const shaped = shapeCurrency(currencyMeta?.currency);
        const rate = currencyMeta?.exchangeRate || 1;
        return (storeAmount) => formatAmount(convertAmount(storeAmount, rate, shaped?.decimalPlaces ?? 2), shaped);
    } catch (err) {
        throw err;
    }
};

// Every active currency, for the Company Settings "Store currency" dropdown.
const fetchActiveCurrencies = async () => {
    try {
        const currencies = await CurrencyMaster.find({ status: 'A' }).sort({ short_name: 1 }).lean();
        return common.returnResult(true, 200, 'Currencies fetched successfully', {
            currencies: currencies.map((currency) => ({ _id: currency._id, ...shapeCurrency(currency) }))
        });
    } catch (err) {
        throw err;
    }
};

// What the storefront needs to show prices: the customer's currency, the store
// currency, and the rate between them (prices arrive in store currency and are
// converted for display with exactly this rate).
const fetchCurrencyContext = async ({ countryId, companyMasterData, companySettingsData }) => {
    try {
        const result = await resolveCustomerCurrency({ countryId, companyMasterData, companySettingsData });
        if (!result.isSuccess) return result;
        const { storeCurrency, currency, exchangeRate, rateFetchedAt, isConverted } = result.meta;
        return common.returnResult(true, 200, 'Currency fetched successfully', {
            currency: shapeCurrency(currency),
            storeCurrency: shapeCurrency(storeCurrency),
            exchangeRate,
            rateFetchedAt,
            isConverted
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    shapeCurrency,
    getStoreCurrency,
    resolveCustomerCurrency,
    convertAmount,
    convertLines,
    buildOrderCurrencyFields,
    formatAmount,
    buildMoneyFormatter,
    fetchActiveCurrencies,
    fetchCurrencyContext
};
