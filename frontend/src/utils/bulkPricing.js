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

export default { bulkUnitPrice };
