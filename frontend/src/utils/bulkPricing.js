/**
 * Unit price for a quantity under a size's bulk pricing tiers - mirrors
 * backend/utils/bulkPricing.js: the tier with the highest minimumQuantity the
 * quantity has reached applies (the last tier keeps applying past its max),
 * and a tier never raises the price above the normal one. A preview only -
 * the backend re-prices every line itself.
 *
 * @param {number} unitPrice - The size's normal price.
 * @param {Array<{ minimumQuantity: number, maximumQuantity: number, price: number }>} tiers
 * @param {number} quantity
 * @returns {number}
 */
export const bulkUnitPrice = (unitPrice, tiers, quantity) => {
  const tier = (tiers || []).reduce(
    (best, t) => (quantity >= t.minimumQuantity && (!best || t.minimumQuantity > best.minimumQuantity) ? t : best),
    null
  );
  return tier && tier.price < unitPrice ? tier.price : unitPrice;
};

/**
 * The price to use for one local/international price pair - mirrors
 * backend/utils/internationalPrice.js. For an international customer
 * (priceZone = { isInternational: true, exchangeRate }) an entered
 * international price becomes its store-currency equivalent
 * (internationalPrice / exchangeRate), so converting it at exchangeRate gives
 * exactly the entered price; no international price = the local price.
 *
 * @param {number} price - The local (store currency) price.
 * @param {number|null} [internationalPrice]
 * @param {{ isInternational: boolean, exchangeRate: number }|null} [priceZone]
 * @returns {number}
 */
export const zonePrice = (price, internationalPrice, priceZone) => {
  const isInternational = !!priceZone?.isInternational && Number(priceZone.exchangeRate) > 0;
  if (!isInternational || internationalPrice === null || internationalPrice === undefined) return price;
  return Number(internationalPrice) / Number(priceZone.exchangeRate);
};

/** Bulk tiers with each price resolved by zonePrice. */
export const zoneTiers = (tiers, priceZone) =>
  (tiers || []).map((tier) => ({ ...tier, price: zonePrice(tier.price, tier.internationalPrice, priceZone) }));

export default { bulkUnitPrice, zonePrice, zoneTiers };
