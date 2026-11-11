const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const common = require('../utils/common');
const addressService = require('./addressService');
const shippingPriceCalculationService = require('./shippingPriceCalculationService');
const taxCalculationService = require('./taxCalculationService');
const ipCountryService = require('./ipCountryService');
const { SHIPPING_PRICE_METHODS } = require('../constants/shippingPriceConstants');

// Which part of the delivery location each location-based method prices off.
const LOCATION_FIELD_BY_METHOD = {
    [SHIPPING_PRICE_METHODS.COUNTRY]: 'countryId',
    [SHIPPING_PRICE_METHODS.STATE]: 'stateId',
    [SHIPPING_PRICE_METHODS.CITY]: 'cityId',
    [SHIPPING_PRICE_METHODS.ZIP]: 'zipCode'
};

const ownerFilter = (cartOwner) => {
    try {
        return cartOwner.type === 'user' ? { userId: cartOwner.id } : { guestId: cartOwner.id };
    } catch (err) {
        throw err;
    }
};

const buildLabelFromNames = async ({ countryId, stateId, cityId, zipCode }) => {
    try {
        const [country, state, city] = await Promise.all([
            countryId ? CountryMaster.findById(countryId).select('country_name').lean() : null,
            stateId ? StateMaster.findById(stateId).select('state_name').lean() : null,
            cityId ? CityMaster.findById(cityId).select('city_name').lean() : null
        ]);
        return [city?.city_name, state?.state_name, country?.country_name, zipCode].filter(Boolean).join(', ');
    } catch (err) {
        throw err;
    }
};

/*
| Resolves where the order is being delivered, in priority order:
|   1. the address explicitly chosen (checkout), else
|   2. the logged-in user's default address, else
|   3. the browsing location cookies (guest, or a user with no address yet), else
|   4. nothing (deliveringTo: null) - location-based prices can't be estimated.
*/
const resolveDeliveryLocation = async ({ vendorId, userId, addressId, cookieLocation }) => {
    try {
        if (userId) {
            let address = null;
            if (addressId) {
                address = await Address.findOne({ _id: addressId, userId, vendorId, status: { $ne: 'D' } });
                if (!address) {
                    return common.returnResult(false, 404, 'Address not found');
                }
            } else {
                address = await addressService.getDefaultAddress({ userId, vendorId });
            }
            if (address) {
                const locationContext = {
                    countryId: address.country_id,
                    stateId: address.state_id,
                    cityId: address.city_id,
                    zipCode: address.pincode
                };
                const label = await buildLabelFromNames(locationContext);
                return common.returnResult(true, 200, 'Location resolved', {
                    locationContext,
                    deliveringTo: { source: 'ADDRESS', addressId: address._id, addressName: address.address_name, label }
                });
            }
        }

        const hasCookieLocation = !!(cookieLocation && (cookieLocation.countryId || cookieLocation.stateId || cookieLocation.cityId || cookieLocation.zipCode));
        if (hasCookieLocation) {
            const label = await buildLabelFromNames(cookieLocation);
            return common.returnResult(true, 200, 'Location resolved', {
                locationContext: cookieLocation,
                deliveringTo: { source: 'LOCATION', addressId: null, addressName: null, label }
            });
        }

        return common.returnResult(true, 200, 'No location available', {
            locationContext: { countryId: null, stateId: null, cityId: null, zipCode: null },
            deliveringTo: null
        });
    } catch (err) {
        throw err;
    }
};

// A visitor country's display name: a CountryMaster _id, or an unlisted-country
// key from IP detection (named from its ISO code).
const resolveCountryName = async (countryKey) => {
    try {
        const unlistedIsoCode = ipCountryService.parseUnlistedCountryKey(countryKey);
        if (unlistedIsoCode) {
            return new Intl.DisplayNames(['en'], { type: 'region' }).of(unlistedIsoCode) || unlistedIsoCode;
        }
        if (!mongoose.Types.ObjectId.isValid(countryKey)) return null;
        const country = await CountryMaster.findById(countryKey).select('country_name').lean();
        return country?.country_name || null;
    } catch (err) {
        throw err;
    }
};

const buildEstimateLineItems = async (cart) => {
    try {
        const liveProducts = await Product.find({ _id: { $in: cart.products.map((p) => p.productId) } });
        const liveProductMap = new Map(liveProducts.map((p) => [p._id.toString(), p]));

        const lineItems = [];
        for (const productEntry of cart.products) {
            const liveProduct = liveProductMap.get(productEntry.productId.toString());
            if (!liveProduct) continue;
            for (const variantEntry of productEntry.variants) {
                const liveVariant = liveProduct.variants.id(variantEntry.variantId);
                if (!liveVariant) continue;
                for (const sizeEntry of variantEntry.sizes) {
                    const liveSize = liveVariant.sizes.id(sizeEntry.sizeId);
                    if (!liveSize) continue;
                    lineItems.push({
                        quantity: sizeEntry.quantity,
                        // The cart's own price (bulk tier price when one applies), so
                        // the "free above" threshold sees what the customer actually pays.
                        amount: sizeEntry.unitPrice * sizeEntry.quantity,
                        shippingType: liveSize.shipping?.type || null,
                        shippingValue: liveSize.shipping?.type === 'CUSTOM' ? liveSize.shipping.value : null,
                        mainCategoryId: liveProduct.mainCategory,
                        subCategoryId: liveProduct.subCategory,
                        weight: liveSize.weight || null,
                        taxIds: liveProduct.taxIds || [],
                        taxBreakdown: []
                    });
                }
            }
        }
        return lineItems;
    } catch (err) {
        throw err;
    }
};

/*
| Shipping ESTIMATE for the cart/checkout pages (no side effects on the cart,
| unlike checkoutCart). With no delivery location known, the visitor's country
| (cookie, saved country, else IP - visitorCountryId) is used: enough for
| country-priced shipping and the country's free-shipping amount; state/city/
| zip pricing still needs an address. The final amount is always recomputed
| against the real shipping address when the order is placed
| (orderService.createOrderFromCart).
*/
const getShippingEstimate = async ({ vendorId, cartOwner, userId, addressId, cookieLocation, visitorCountryId = null, companyMasterData, websiteMasterData, companySettingsData, shippingPriceSettingsData }) => {
    try {
        const featureOn = !!(websiteMasterData?.isShippingPriceFeatureOn && companyMasterData?.isShippingPriceFeatureOn);
        if (!featureOn || !shippingPriceSettingsData) {
            return common.returnResult(true, 200, 'Shipping price is not enabled', { enabled: false });
        }

        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(true, 200, 'Cart is empty', { enabled: false });
        }

        const locationResult = await resolveDeliveryLocation({ vendorId, userId, addressId, cookieLocation });
        if (!locationResult.isSuccess) {
            return locationResult;
        }
        const { deliveringTo } = locationResult.meta;
        let { locationContext } = locationResult.meta;

        // No delivery location: estimate for the visitor's own country.
        let estimatedCountryName = null;
        if (!locationContext.countryId && visitorCountryId) {
            locationContext = { countryId: visitorCountryId, stateId: null, cityId: null, zipCode: null };
            estimatedCountryName = await resolveCountryName(visitorCountryId);
        }

        const lineItems = await buildEstimateLineItems(cart);
        const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0);

        const shippingResult = await shippingPriceCalculationService.calculateShippingPriceAmount({
            lineItems,
            subtotal,
            shippingPriceSettings: shippingPriceSettingsData,
            locationContext,
            companyMasterData,
            websiteMasterData,
            companySettingsData
        });
        const { shippingAmount, breakdown } = shippingResult.meta;

        // A location-based method with no location at all can't be priced -
        // report "unknown" (null) rather than misleadingly quoting the rest price.
        const requiredField = LOCATION_FIELD_BY_METHOD[breakdown.method];
        const needsLocation = !!requiredField && !locationContext[requiredField];
        // Priced in another currency with no exchange rate right now.
        const isRateUnavailable = breakdown.isRateUnavailable === true;

        return common.returnResult(true, 200, 'Shipping estimate calculated successfully', {
            enabled: true,
            method: breakdown.method,
            shippingAmount: needsLocation || isRateUnavailable ? null : shippingAmount,
            isFree: !needsLocation && !isRateUnavailable && !breakdown.isShippingPending && shippingAmount === 0,
            isShippingPending: breakdown.isShippingPending === true,
            needsLocation,
            isRateUnavailable,
            breakdown,
            // Set = estimated for the visitor's country (no delivery address yet).
            estimatedCountryName: needsLocation || isRateUnavailable ? null : estimatedCountryName,
            deliveringTo
        });
    } catch (err) {
        throw err;
    }
};

/*
| The visitor's country (the one their currency follows - cookie, saved
| country, else IP) as a tax location, when it is known and is NOT the store
| country: a customer abroad must not be shown the store country's taxes (e.g.
| GST to a US visitor). Country only - a state-specific tax can't match. null =
| use the store's location (visitor in the store country, or country unknown).
| An unlisted-country key from IP detection matches no tax, so it estimates 0.
*/
const resolveVisitorTaxLocation = async (visitorCountryId, companySettingsData) => {
    try {
        if (!visitorCountryId) return null;
        const storeCountryId = companySettingsData?.storeCountryId || null;
        const unlistedIsoCode = ipCountryService.parseUnlistedCountryKey(visitorCountryId);

        if (unlistedIsoCode) {
            const storeCountry = storeCountryId ? await CountryMaster.findById(storeCountryId).select('short_country_name').lean() : null;
            if (storeCountry && storeCountry.short_country_name === unlistedIsoCode) return null;
        } else {
            if (!mongoose.Types.ObjectId.isValid(visitorCountryId)) return null;
            if (storeCountryId && visitorCountryId.toString() === storeCountryId.toString()) return null;
        }
        const countryName = await resolveCountryName(visitorCountryId);

        return {
            countryId: visitorCountryId,
            stateId: null,
            cityId: null,
            zipCode: null,
            isStoreLocation: false,
            countryName
        };
    } catch (err) {
        throw err;
    }
};

/*
| Tax ESTIMATE for the cart/checkout pages, against the same delivery location
| the shipping estimate uses (chosen address, default address, browsing
| location). When none is known: the visitor's country if it is outside the
| store country (resolveVisitorTaxLocation), else the store's location. The
| final tax is recomputed against the real shipping address when the order is
| placed (cartService.checkoutCart via orderService.createOrderFromCart).
*/
const getTaxEstimate = async ({ vendorId, cartOwner, userId, addressId, cookieLocation, visitorCountryId = null, companySettingsData }) => {
    try {
        const cart = await Cart.findOne({ vendorId, status: 'A', ...ownerFilter(cartOwner) });
        if (!cart || cart.products.length === 0) {
            return common.returnResult(true, 200, 'Cart is empty', { totalTaxAmount: 0, taxes: [], isStoreLocation: false, estimatedCountryName: null, deliveringTo: null });
        }

        const locationResult = await resolveDeliveryLocation({ vendorId, userId, addressId, cookieLocation });
        if (!locationResult.isSuccess) {
            return locationResult;
        }
        const { locationContext, deliveringTo } = locationResult.meta;

        const lineItems = await buildEstimateLineItems(cart);
        const visitorTaxLocation = locationContext.countryId ? null : await resolveVisitorTaxLocation(visitorCountryId, companySettingsData);
        const taxLocation = visitorTaxLocation || taxCalculationService.resolveTaxLocationContext(locationContext, companySettingsData);
        await taxCalculationService.applyTaxesToLines(lineItems, taxLocation);
        const { taxes, totalTaxAmount } = taxCalculationService.summarizeTaxes(lineItems);

        return common.returnResult(true, 200, 'Tax estimate calculated successfully', {
            totalTaxAmount,
            taxes,
            // true = priced at the store's location because the customer's is unknown.
            isStoreLocation: taxLocation.isStoreLocation && !!taxLocation.countryId,
            // Set = estimated for the visitor's country (outside the store
            // country) until a delivery address is chosen.
            estimatedCountryName: visitorTaxLocation ? (visitorTaxLocation.countryName || 'your country') : null,
            deliveringTo
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getShippingEstimate,
    getTaxEstimate
};
