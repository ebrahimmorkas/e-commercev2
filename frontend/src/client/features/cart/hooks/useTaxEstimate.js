import { useEffect, useState } from 'react';
import { getTaxEstimate } from '../api/cartApi';

/**
 * Loads the tax estimate for the current cart - same inputs and refresh rules
 * as useShippingEstimate (the chosen address, else the default address or
 * browsing location, else the store's own location). The final tax is
 * recomputed when the order is placed, so a failed estimate just resolves to
 * `null` (the Tax row is hidden).
 *
 * @param {Object} [options]
 * @param {string|null} [options.addressId] - Saved address to price against (checkout).
 * @param {*} [options.refreshKey] - Any value that changes when the cart does.
 * @param {boolean} [options.skip] - Don't fetch (e.g. empty cart).
 * @returns {{ estimate: { totalTaxAmount: number, taxes: Array, isStoreLocation: boolean } | null }}
 */
export const useTaxEstimate = ({ addressId = null, refreshKey = null, skip = false } = {}) => {
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    getTaxEstimate(addressId)
      .then((result) => {
        if (!cancelled) setEstimate(result || null);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [addressId, refreshKey, skip]);

  // A skipped (e.g. emptied) cart never shows a stale estimate.
  return { estimate: skip ? null : estimate };
};

// The amount to add to an estimated total - 0 whenever it isn't known yet.
export const taxAmountForTotal = (estimate) => (estimate && typeof estimate.totalTaxAmount === 'number' ? estimate.totalTaxAmount : 0);

export default useTaxEstimate;
