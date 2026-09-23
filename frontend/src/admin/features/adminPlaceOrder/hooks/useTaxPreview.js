import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 400;

/**
 * Live, server-calculated tax preview for an order being built (Place Order,
 * and Edit Order's "add products"). Re-fetches, debounced, whenever `request`
 * changes; a result is only shown while it still matches the current request,
 * so a slow response never overwrites a newer one.
 *
 * @param {(request: Object) => Promise<Object>} fetchPreview - Must be a stable (module-level) function.
 * @param {Object|null} request - The preview body, or null when there is nothing to price yet.
 * @returns {{ preview: Object|null, loading: boolean, error: string }}
 */
export const useTaxPreview = (fetchPreview, request) => {
  const key = request ? JSON.stringify(request) : null;
  const [result, setResult] = useState({ key: null, preview: null, error: '' });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchPreview(JSON.parse(key))
        .then((preview) => {
          if (!cancelled) setResult({ key, preview, error: '' });
        })
        .catch((err) => {
          if (!cancelled) setResult({ key, preview: null, error: err.message || 'Could not calculate tax' });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, fetchPreview]);

  const isCurrent = !!key && result.key === key;
  return {
    preview: isCurrent ? result.preview : null,
    loading: !!key && !isCurrent,
    error: isCurrent ? result.error : '',
  };
};

export default useTaxPreview;
