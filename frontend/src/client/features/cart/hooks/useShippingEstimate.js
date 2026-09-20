import { useEffect, useState } from 'react';
import { getShippingEstimate } from '../api/cartApi';

/**
 * Loads the shipping estimate for the current cart and re-loads it whenever
 * `refreshKey` (e.g. the cart's item count/subtotal) or the chosen address
 * changes. A failed estimate is not an error worth surfacing to the shopper -
 * the final shipping is recomputed when the order is placed - so it just
 * resolves to `null` (nothing shown).
 *
 * @param {Object} [options]
 * @param {string|null} [options.addressId] - Saved address to price against (checkout).
 * @param {*} [options.refreshKey] - Any value that changes when the cart does.
 * @param {boolean} [options.skip] - Don't fetch (e.g. empty cart).
 */
export const useShippingEstimate = ({ addressId = null, refreshKey = null, skip = false } = {}) => {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skip) {
      setEstimate(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getShippingEstimate(addressId)
      .then((result) => {
        if (!cancelled) setEstimate(result?.enabled ? result : null);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addressId, refreshKey, skip]);

  return { estimate, loading };
};

export default useShippingEstimate;
