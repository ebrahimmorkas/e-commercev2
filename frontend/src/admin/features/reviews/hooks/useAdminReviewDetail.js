import { useCallback, useEffect, useState } from 'react';
import { getAdminReviewDetail } from '../api/reviewAdminApi';

/**
 * One review with its original version and history, for the detail modal.
 * `loading` is derived from whether the answer belongs to the current
 * review + reload, so nothing is set synchronously inside the effect.
 */
export const useAdminReviewDetail = (reviewId) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, review: null, permissions: null, error: '' });
  const key = reviewId ? `${reviewId}|${reloadKey}` : null;

  useEffect(() => {
    if (!reviewId) return undefined;
    let cancelled = false;
    getAdminReviewDetail(reviewId)
      .then((data) => {
        if (!cancelled) setResult({ key, review: data?.review || null, permissions: data?.permissions || null, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setResult((prev) => ({ ...prev, key, error: err?.message || 'Failed to load the review' }));
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId, key]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  const isCurrent = result.key === key;
  // A reload keeps showing the review already on screen.
  const hasSameReview = result.review && result.key?.startsWith(`${reviewId}|`);

  return {
    review: hasSameReview ? result.review : null,
    permissions: hasSameReview ? result.permissions : null,
    loading: !isCurrent,
    error: isCurrent ? result.error : '',
    reload,
  };
};

export default useAdminReviewDetail;
