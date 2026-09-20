const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const common = require('../utils/common');
const addressService = require('./addressService');
const shippingPriceCalculationService = require('./shippingPriceCalculationService');
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
                        amount: liveSize.price * sizeEntry.quantity,
                        shippingType: liveSize.shipping?.type || null,
                        shippingValue: liveSize.shipping?.type === 'CUSTOM' ? liveSize.shipping.value : null,
                        mainCategoryId: liveProduct.mainCategory,
                        subCategoryId: liveProduct.subCategory,
                        weight: liveSize.weight || null
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
| unlike checkoutCart). The final amount is always recomputed against the real
| shipping address when the order is placed (orderService.createOrderFromCart).
*/
const getShippingEstimate = async ({ vendorId, cartOwner, userId, addressId, cookieLocation, companyMasterData, websiteMasterData, shippingPriceSettingsData }) => {
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
        const { locationContext, deliveringTo } = locationResult.meta;

        const lineItems = await buildEstimateLineItems(cart);
        const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0);

        const shippingResult = await shippingPriceCalculationService.calculateShippingPriceAmount({
            lineItems,
            subtotal,
            shippingPriceSettings: shippingPriceSettingsData,
            locationContext,
            companyMasterData,
            websiteMasterData
        });
        const { shippingAmount, breakdown } = shippingResult.meta;

        // A location-based method with no location at all can't be priced -
        // report "unknown" (null) rather than misleadingly quoting the rest price.
        const requiredField = LOCATION_FIELD_BY_METHOD[breakdown.method];
        const needsLocation = !!requiredField && !locationContext[requiredField];

        return common.returnResult(true, 200, 'Shipping estimate calculated successfully', {
            enabled: true,
            method: breakdown.method,
            shippingAmount: needsLocation ? null : shippingAmount,
            isFree: !needsLocation && !breakdown.isShippingPending && shippingAmount === 0,
            isShippingPending: breakdown.isShippingPending === true,
            needsLocation,
            breakdown,
            deliveringTo
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getShippingEstimate
};
