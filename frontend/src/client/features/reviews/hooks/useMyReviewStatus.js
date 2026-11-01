import { useCallback, useEffect, useState } from 'react';
import { getMyOrderReviewStatus, getMyProductReviewStatus } from '../api/reviewApi';

// Shared loader: runs `request` while `enabled`. Each response is tagged with
// the request that produced it, so `loading`/`data` are derived (no state
// reset inside the effect) and a stale response is never shown.
const useStatusRequest = (request, enabled) => {
  const [result, setResult] = useState({ request: null, reloadKey: -1, data: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    request()
      .then((data) => data || null)
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setResult({ request, reloadKey, data });
      });
    return () => {
      cancelled = true;
    };
  }, [request, enabled, reloadKey]);

  const isCurrent = result.request === request && result.reloadKey === reloadKey;
  // Keep showing the previous answer for the same request while a reload runs.
  const data = enabled && result.request === request ? result.data : null;
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { data, loading: enabled && !isCurrent, reload };
};

/**
 * Product page: { canWrite, reason ('NOT_PURCHASED' | 'ALREADY_REVIEWED'),
 * remaining, eligibleOrders, myReviews } for the logged-in customer.
 */
export const useMyProductReviewStatus = (productId, enabled) => {
  const request = useCallback(() => getMyProductReviewStatus(productId), [productId]);
  return useStatusRequest(request, enabled && !!productId);
};

/**
 * Order page: { isDelivered, products: [{ productId, canWrite, review }] }
 * for the logged-in customer's order.
 */
export const useMyOrderReviewStatus = (orderId, enabled) => {
  const request = useCallback(() => getMyOrderReviewStatus(orderId), [orderId]);
  return useStatusRequest(request, enabled && !!orderId);
};
