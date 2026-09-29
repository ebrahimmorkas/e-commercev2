import { useCallback, useEffect, useState } from 'react';
import {
  getEligibleFreeCash,
  applyFreeCash as applyFreeCashRequest,
  removeFreeCash as removeFreeCashRequest,
} from '../api/cartApi';

/**
 * The cart page's Free Cash: what the shopper could apply (refetched whenever
 * the cart changes - a category campaign only shows up once the cart has an
 * item from it), plus apply/remove. Both answer with the updated cart, handed
 * to `onCartUpdated` so useCart's copy stays the single source of truth.
 *
 * `rejections` holds the reasons ("Add items worth X more...") for the
 * selection that couldn't be applied, from the last apply/remove.
 *
 * @param {Object} [options]
 * @param {*} [options.refreshKey] - Any value that changes when the cart (or login) does.
 * @param {boolean} [options.skip] - Don't fetch (e.g. empty cart).
 * @param {Function} [options.onCartUpdated] - Called with the cart returned by apply/remove.
 */
export const useFreeCash = ({ refreshKey = null, skip = false, onCartUpdated } = {}) => {
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rejections, setRejections] = useState([]);

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    getEligibleFreeCash()
      .then((result) => {
        if (!cancelled) setInfo(result || null);
      })
      .catch(() => {
        // Free Cash is optional - the cart works without it.
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, skip]);

  const apply = useCallback(
    async (freeCashIds) => {
      setSaving(true);
      setRejections([]);
      try {
        const result = await applyFreeCashRequest(freeCashIds);
        onCartUpdated?.(result.cart);
        setRejections(result.rejectedFreeCash || []);
      } catch (err) {
        setRejections(err.errors?.rejected?.length > 1 ? err.errors.rejected : [{ reason: err.message }]);
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
      const result = await removeFreeCashRequest();
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

export default useFreeCash;
