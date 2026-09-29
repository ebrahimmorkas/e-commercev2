import { useCallback, useEffect, useState } from 'react';
import {
  getEligibleDiscounts,
  applyDiscounts as applyDiscountsRequest,
  removeDiscounts as removeDiscountsRequest,
} from '../api/cartApi';

/**
 * The cart page's discounts - same shape as useFreeCash: what the shopper
 * could apply (refetched whenever the cart changes), plus apply/remove, both
 * handing the updated cart to `onCartUpdated`.
 *
 * `rejections` holds the reasons for whatever couldn't be applied, from the
 * last apply/remove.
 *
 * @param {Object} [options]
 * @param {*} [options.refreshKey] - Any value that changes when the cart (or login) does.
 * @param {boolean} [options.skip] - Don't fetch (e.g. empty cart).
 * @param {Function} [options.onCartUpdated] - Called with the cart returned by apply/remove.
 */
export const useDiscounts = ({ refreshKey = null, skip = false, onCartUpdated } = {}) => {
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rejections, setRejections] = useState([]);

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    getEligibleDiscounts()
      .then((result) => {
        if (!cancelled) setInfo(result || null);
      })
      .catch(() => {
        // Discounts are optional - the cart works without them.
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, skip]);

  /** @returns {Promise<boolean>} true when something was applied. */
  const apply = useCallback(
    async ({ discountIds = [], couponCode = '' } = {}) => {
      setSaving(true);
      setRejections([]);
      try {
        const result = await applyDiscountsRequest({ discountIds, couponCode });
        onCartUpdated?.(result.cart);
        setRejections(result.rejectedDiscounts || []);
        return true;
      } catch (err) {
        setRejections(err.errors?.rejected?.length > 1 ? err.errors.rejected : [{ reason: err.message }]);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onCartUpdated]
  );

  const remove = useCallback(async () => {
    setSaving(true);
    setRejections([]);
    try {
      const result = await removeDiscountsRequest();
      onCartUpdated?.(result.cart);
    } catch (err) {
      setRejections([{ reason: err.message }]);
    } finally {
      setSaving(false);
    }
  }, [onCartUpdated]);

  // A skipped (e.g. emptied) cart never shows a stale list.
  return { info: skip ? null : info, saving, rejections, apply, remove };
};

export default useDiscounts;
