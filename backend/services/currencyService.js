const mongoose = require('mongoose');
const CurrencyMaster = require('../models/CurrencyMaster');
const CountryMaster = require('../models/CountryMaster');
const common = require('../utils/common');
const redisKeys = require('../utils/redisKeys');
const redisService = require('./redisService');
const websiteMasterService = require('./websiteMasterService');
const exchangeRateService = require('./exchangeRateService');
const internationalPrice = require('../utils/internationalPrice');
const ipCountryService = require('./ipCountryService');

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
| - Conversion happens only while isCurrencyConversionFeatureOn is on in
|   WebsiteMaster, CompanyMaster AND CompanySettings. Any one off = every
|   customer, from any country, sees and pays in the store currency.
| - International pricing (isInternationalPriceFeatureOn + isIPDetectionFeatureOn
|   in WebsiteMaster AND CompanyMaster) replaces conversion: customers outside
|   CompanySettings.storeCountryId - served countries or not - see and pay the
|   products' international prices in CompanyMaster.internationalCurrency
|   (no international price = the local price converted to it).
| - With IP detection on, a visitor's country comes from their IP whenever it
|   isn't known otherwise (middlewares/ipCountryDetection.js).
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

// WebsiteMaster is read here (Redis-cached, same key as ensureVendorDataCached)
// so callers outside a request - e.g. promotion emails - get the same answer.
const loadWebsiteMaster = async () => {
    try {
        return await redisService.getOrSet(
            redisKeys.websiteMaster(),
            async () => await websiteMasterService.fetchWebsiteMasterData(),
            3600
        );
    } catch (err) {
        throw err;
    }
};

// The three-level isCurrencyConversionFeatureOn switch. A missing flag counts
// as on: it defaults to true, and vendor data cached before the field existed
// must not silently switch conversion off.
const isCurrencyConversionOn = (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        return [websiteMasterData, companyMasterData, companySettingsData]
            .every((data) => data?.isCurrencyConversionFeatureOn !== false);
    } catch (err) {
        throw err;
    }
};

// Two-level (WebsiteMaster AND CompanyMaster) switch that defaults to off -
// so a missing flag counts as off.
const isMasterFeatureOn = (websiteMasterData, companyMasterData, flag) => {
    try {
        return websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
    } catch (err) {
        throw err;
    }
};

// isIPDetectionFeatureOn: a visitor's country may be taken from their IP.
const isIPDetectionOn = async (companyMasterData, websiteMasterData = null) => {
    try {
        const website = websiteMasterData || await loadWebsiteMaster();
        return isMasterFeatureOn(website, companyMasterData, 'isIPDetectionFeatureOn');
    } catch (err) {
        throw err;
    }
};

// The international currency when international pricing is live, else null.
// Live = isInternationalPriceFeatureOn AND isIPDetectionFeatureOn (it needs
// IP detection - off means international pricing is off too), plus a store
// country to tell local from international customers and an active
// CompanyMaster.internationalCurrency.
const getActiveInternationalCurrency = async (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        if (!isMasterFeatureOn(websiteMasterData, companyMasterData, 'isInternationalPriceFeatureOn')) return null;
        if (!isMasterFeatureOn(websiteMasterData, companyMasterData, 'isIPDetectionFeatureOn')) return null;
        if (!isObjectId(companySettingsData?.storeCountryId) || !isObjectId(companyMasterData?.internationalCurrency)) return null;
        return await CurrencyMaster.findOne({ _id: companyMasterData.internationalCurrency, status: 'A' }).lean();
    } catch (err) {
        throw err;
    }
};

// Whether a customer's country is known AND is not the store country. The
// country is a CountryMaster _id, or an unlisted-country key from IP
// detection (a country not in CountryMaster - always outside the store
// country unless its ISO code is the store country's). Unknown = not outside.
const isOutsideStoreCountry = async (countryKey, storeCountryId) => {
    try {
        const unlistedIsoCode = ipCountryService.parseUnlistedCountryKey(countryKey);
        if (unlistedIsoCode) {
            const storeCountry = await CountryMaster.findOne({ _id: storeCountryId }).select('short_country_name').lean();
            return !storeCountry || storeCountry.short_country_name !== unlistedIsoCode;
        }
        return isObjectId(countryKey) && countryKey.toString() !== storeCountryId.toString();
    } catch (err) {
        throw err;
    }
};

/**
 * Which currency a customer from `countryId` sees and pays in.
 *
 * International pricing (when live) wins over conversion: a customer outside
 * the store country gets the international currency and the products'
 * international prices; one inside it (or of unknown country) the store
 * currency and local prices. `deliveryCountryId` - the order's shipping
 * address country - decides this when known (an order's final price follows
 * where it is delivered, not where it was placed from).
 *
 * @returns returnResult - meta: { storeCurrency, currency, exchangeRate, rateFetchedAt, isConverted, isInternationalPrice }
 *   (storeCurrency/currency are CurrencyMaster docs; exchangeRate = currency units per 1 store unit).
 */
const resolveCustomerCurrency = async ({ countryId, deliveryCountryId = null, companyMasterData, companySettingsData }) => {
    try {
        const storeCurrency = await getStoreCurrency(companySettingsData);
        if (!storeCurrency) {
            return common.returnResult(false, 500, 'Store currency is not configured. Please contact support.');
        }
        const storeResult = { storeCurrency, currency: storeCurrency, exchangeRate: 1, rateFetchedAt: null, isConverted: false, isInternationalPrice: false };

        const websiteMasterData = await loadWebsiteMaster();
        const internationalCurrency = await getActiveInternationalCurrency(websiteMasterData, companyMasterData, companySettingsData);
        if (internationalCurrency) {
            const isInternationalCustomer = await isOutsideStoreCountry(deliveryCountryId || countryId, companySettingsData.storeCountryId);
            if (!isInternationalCustomer) {
                return common.returnResult(true, 200, 'Local price', storeResult);
            }

            let rate = { rate: 1, fetchedAt: null };
            if (internationalCurrency.short_name !== storeCurrency.short_name) {
                rate = await exchangeRateService.getFreshRate(storeCurrency.short_name, internationalCurrency.short_name);
                // Without a rate an international price can't be priced against
                // the rest of the cart - fall back to local prices.
                if (!rate) {
                    return common.returnResult(true, 200, 'No fresh exchange rate - local price', storeResult);
                }
            }

            return common.returnResult(true, 200, 'International price', {
                storeCurrency,
                currency: internationalCurrency,
                exchangeRate: rate.rate,
                rateFetchedAt: rate.fetchedAt,
                isConverted: internationalCurrency.short_name !== storeCurrency.short_name,
                isInternationalPrice: true
            });
        }

        if (!isCurrencyConversionOn(websiteMasterData, companyMasterData, companySettingsData)) {
            return common.returnResult(true, 200, 'Currency conversion is off - store currency', storeResult);
        }

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
            isConverted: true,
            isInternationalPrice: false
        });
    } catch (err) {
        throw err;
    }
};

// The international currency (shaped) while international pricing is live for
// this vendor, else null - admin screens show the international price fields
// only then.
const fetchActiveInternationalCurrency = async ({ companyMasterData, companySettingsData }) => {
    try {
        const websiteMasterData = await loadWebsiteMaster();
        const currency = await getActiveInternationalCurrency(websiteMasterData, companyMasterData, companySettingsData);
        return currency ? shapeCurrency(currency) : null;
    } catch (err) {
        throw err;
    }
};

// The priceZone (utils/internationalPrice.js) for a resolved currency.
const toPriceZone = (currencyMeta) => {
    try {
        return currencyMeta?.isInternationalPrice
            ? { isInternational: true, exchangeRate: currencyMeta.exchangeRate }
            : internationalPrice.LOCAL_PRICE_ZONE;
    } catch (err) {
        throw err;
    }
};

// Which product prices (local / international) a customer gets - same inputs
// as resolveCustomerCurrency. Local when the store currency isn't configured.
const resolvePriceZone = async ({ countryId, deliveryCountryId = null, companyMasterData, companySettingsData }) => {
    try {
        const result = await resolveCustomerCurrency({ countryId, deliveryCountryId, companyMasterData, companySettingsData });
        return result.isSuccess ? toPriceZone(result.meta) : internationalPrice.LOCAL_PRICE_ZONE;
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
        const { currency, storeCurrency, exchangeRate, isInternationalPrice } = currencyMeta;
        return {
            currencyId: currency._id,
            currencyCode: currency.short_name,
            currencySymbol: currency.symbol,
            currencySymbolPosition: currency.symbol_position,
            currencyDecimalPlaces: typeof currency.decimal_places === 'number' ? currency.decimal_places : 2,
            exchangeRate: exchangeRate || 1,
            storeCurrencyCode: storeCurrency.short_name,
            isInternationalPrice: !!isInternationalPrice
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

// The active currencies of the countries a vendor serves
// (CompanyMaster.allowedCountries) - the only ones it may pick as its store
// currency. Follows both country <-> currency links, like getCountryCurrency.
const findCurrenciesForCountries = async (allowedCountryIds) => {
    try {
        const countryIds = (allowedCountryIds || []).filter(isObjectId);
        if (countryIds.length === 0) return [];
        const countries = await CountryMaster.find({ _id: { $in: countryIds }, status: 'A' }).select('currency_id').lean();
        if (countries.length === 0) return [];
        return await CurrencyMaster.find({
            status: 'A',
            $or: [
                { _id: { $in: countries.map((country) => country.currency_id).filter(Boolean) } },
                { country_id: { $in: countries.map((country) => country._id) } }
            ]
        }).sort({ short_name: 1 }).lean();
    } catch (err) {
        throw err;
    }
};

// Whether a vendor serving these countries may use this currency as its store currency.
const isCurrencyAllowedForCountries = async (currencyId, allowedCountryIds) => {
    try {
        if (!isObjectId(currencyId)) return false;
        const currencies = await findCurrenciesForCountries(allowedCountryIds);
        return currencies.some((currency) => currency._id.toString() === currencyId.toString());
    } catch (err) {
        throw err;
    }
};

// The currencies of the vendor's assigned countries, for the Company Settings "Store currency" dropdown.
const fetchCurrenciesForVendor = async (allowedCountryIds) => {
    try {
        const currencies = await findCurrenciesForCountries(allowedCountryIds);
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
const fetchCurrencyContext = async ({ countryId, deliveryCountryId = null, companyMasterData, companySettingsData }) => {
    try {
        const result = await resolveCustomerCurrency({ countryId, deliveryCountryId, companyMasterData, companySettingsData });
        if (!result.isSuccess) return result;
        const { storeCurrency, currency, exchangeRate, rateFetchedAt, isConverted, isInternationalPrice } = result.meta;
        return common.returnResult(true, 200, 'Currency fetched successfully', {
            currency: shapeCurrency(currency),
            storeCurrency: shapeCurrency(storeCurrency),
            exchangeRate,
            rateFetchedAt,
            isConverted,
            isInternationalPrice
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    shapeCurrency,
    getStoreCurrency,
    resolveCustomerCurrency,
    resolvePriceZone,
    toPriceZone,
    fetchActiveInternationalCurrency,
    isIPDetectionOn,
    convertAmount,
    convertLines,
    buildOrderCurrencyFields,
    formatAmount,
    buildMoneyFormatter,
    isCurrencyAllowedForCountries,
    fetchCurrenciesForVendor,
    fetchCurrencyContext
};
