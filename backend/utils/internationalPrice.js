// International pricing - how a product's international price reaches an
// international customer without changing the rest of the pricing pipeline.
//
// Carts, discounts, Free Cash, shipping and tax all work in the STORE
// currency and convert to the customer's currency once, at the end, with the
// resolved exchangeRate (currencyService). For an international customer
// that customer currency is CompanyMaster.internationalCurrency, so a price
// the vendor entered in that currency is turned into its store-currency
// equivalent (internationalPrice / exchangeRate). Converting it back at the
// end gives exactly the entered international price. A product with no
// international price simply keeps its local price - which, converted at the
// same rate, is "the local price in the international currency".
//
// priceZone: { isInternational: boolean, exchangeRate: number } - from
// currencyService.resolveCustomerCurrency (meta.isInternationalPrice /
// meta.exchangeRate). null/undefined = local pricing.

const LOCAL_PRICE_ZONE = Object.freeze({ isInternational: false, exchangeRate: 1 });

const hasValue = (value) => value !== null && value !== undefined;

const isInternationalZone = (priceZone) => {
    try {
        return !!priceZone?.isInternational && Number(priceZone.exchangeRate) > 0;
    } catch (err) {
        throw err;
    }
};

// The amount the pipeline should use (store-currency terms) for one price.
const resolvePrice = (localPrice, internationalPrice, priceZone) => {
    try {
        if (!isInternationalZone(priceZone) || !hasValue(internationalPrice)) return localPrice;
        return Number(internationalPrice) / Number(priceZone.exchangeRate);
    } catch (err) {
        throw err;
    }
};

// A size's selling price and struck-through price for this customer. When
// the size has an international price, its international cancelled price
// goes with it (none = nothing struck through) - a local cancelled price
// converted next to a separately chosen international price could even be
// lower than it.
const resolveSizePrices = (size, priceZone) => {
    try {
        if (!isInternationalZone(priceZone) || !hasValue(size.internationalPrice)) {
            return { price: size.price, cancelledPrice: hasValue(size.cancelledPrice) ? size.cancelledPrice : null };
        }
        return {
            price: resolvePrice(size.price, size.internationalPrice, priceZone),
            cancelledPrice: hasValue(size.internationalCancelledPrice)
                ? resolvePrice(size.cancelledPrice, size.internationalCancelledPrice, priceZone)
                : null
        };
    } catch (err) {
        throw err;
    }
};

// Bulk tiers with their price resolved for this customer (the international
// price itself is never sent to the storefront).
const resolveTierPrices = (tiers, priceZone) => {
    try {
        return (tiers || []).map((tier) => ({
            minimumQuantity: tier.minimumQuantity,
            maximumQuantity: tier.maximumQuantity,
            price: resolvePrice(tier.price, tier.internationalPrice, priceZone)
        }));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    LOCAL_PRICE_ZONE,
    isInternationalZone,
    resolvePrice,
    resolveSizePrices,
    resolveTierPrices
};
