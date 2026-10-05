/**
 * Which bulk tier a quantity has reached, and the resulting unit price. Mirrors
 * the cart's server-side rule (backend/utils/bulkPricing.js findApplicableTier /
 * resolveUnitPrice) so the price shown on cards and the detail page matches what
 * the cart will charge: the tier with the highest minimumQuantity the quantity
 * has reached (the last tier keeps applying above its maximum), and only when it
 * is actually cheaper than the normal price.
 *
 * @param {Array<{minimumQuantity: number, price: number}>} bulkPricing
 * @param {number} quantity - Quantity of this item currently in the cart.
 * @param {number|null} basePrice - The item's normal unit price.
 * @returns {{ tier: Object|null, unitPrice: number|null, isApplied: boolean }}
 */
export const resolveBulkPrice = (bulkPricing, quantity, basePrice) => {
  let tier = null;
  for (const candidate of bulkPricing || []) {
    if (quantity >= candidate.minimumQuantity && (!tier || candidate.minimumQuantity > tier.minimumQuantity)) {
      tier = candidate;
    }
  }
  if (!tier || typeof basePrice !== 'number' || tier.price >= basePrice) {
    return { tier: null, unitPrice: basePrice ?? null, isApplied: false };
  }
  return { tier, unitPrice: tier.price, isApplied: true };
};
