/**
 * Text for the shipping row of the cart/checkout summary, from a
 * /cart/shipping-estimate result (see hooks/useShippingEstimate.js).
 */
export const formatShippingEstimate = (estimate, formatMoney) => {
  if (!estimate) return '';
  if (estimate.isShippingPending) return 'To be confirmed';
  if (estimate.needsLocation) return 'Calculated at checkout';
  if (estimate.isFree) return 'Free';
  return formatMoney(estimate.shippingAmount);
};

// The amount to add to an estimated total - 0 whenever it isn't known yet.
export const shippingAmountForTotal = (estimate) => (estimate && typeof estimate.shippingAmount === 'number' ? estimate.shippingAmount : 0);
