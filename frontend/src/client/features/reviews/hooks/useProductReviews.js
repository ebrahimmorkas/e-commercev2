import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductReviews } from '../api/reviewApi';

const PAGE_SIZE = 10;

/**
 * One product's reviews: rating summary + a "Load more" list that restarts
 * whenever the product, sort or star filter changes.
 *
 * The first page is tagged with the query it answers (`key`), so loading is
 * derived from "is the shown page for the current query?" rather than set
 * inside the effect, and a late answer for an old query is dropped.
 *
 * @param {string} productId
 * @param {{ enabled?: boolean }} [options] - false skips loading (reviews hidden for the store).
 */
export const useProductReviews = (productId, { enabled = true } = {}) => {
  const [sort, setSort] = useState('recent');
  const [rating, setRating] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, summary: null, reviews: [], page: 1, hasMore: false, total: 0, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const key = `${productId}|${sort}|${rating || ''}|${reloadKey}`;

  useEffect(() => {
    if (!enabled || !productId) return undefined;
    const controller = new AbortController();
    getProductReviews(productId, { page: 1, limit: PAGE_SIZE, sort, rating: rating || undefined }, { signal: controller.signal })
      .then((data) => {
        setResult({
          key,
          summary: data?.summary || null,
          reviews: data?.reviews || [],
          page: 1,
          hasMore: !!data?.pagination?.hasMore,
          total: data?.pagination?.total || 0,
          error: null,
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setResult((prev) => ({ ...prev, key, reviews: [], hasMore: false, total: 0, error: err?.message || 'Could not load reviews.' }));
      });
    return () => {
      controller.abort();
      loadMoreRef.current?.abort();
    };
  }, [enabled, productId, sort, rating, key]);

  const isCurrent = result.key === key;

  const loadMore = useCallback(() => {
    if (loadingMore || !isCurrent || !result.hasMore) return;
    const controller = new AbortController();
    loadMoreRef.current = controller;
    const nextPage = result.page + 1;
    setLoadingMore(true);
    getProductReviews(productId, { page: nextPage, limit: PAGE_SIZE, sort, rating: rating || undefined }, { signal: controller.signal })
      .then((data) => {
        setResult((prev) =>
          prev.key !== key
            ? prev
            : {
                ...prev,
                summary: data?.summary || prev.summary,
                reviews: [...prev.reviews, ...(data?.reviews || [])],
                page: nextPage,
                hasMore: !!data?.pagination?.hasMore,
                total: data?.pagination?.total ?? prev.total,
              }
        );
      })
      .catch(() => {})
      .finally(() => {
        if (loadMoreRef.current === controller) setLoadingMore(false);
      });
  }, [loadingMore, isCurrent, result.hasMore, result.page, productId, sort, rating, key]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  // While a new query loads, keep the summary (it doesn't depend on sort or
  // filter) but not the old list.
  const sameProduct = result.key?.startsWith(`${productId}|`);
  return {
    summary: sameProduct ? result.summary : null,
    reviews: isCurrent ? result.reviews : [],
    total: isCurrent ? result.total : 0,
    hasMore: isCurrent && result.hasMore,
    loading: enabled && !!productId && !isCurrent,
    loadingMore,
    error: isCurrent ? result.error : null,
    sort,
    setSort,
    rating,
    setRating,
    loadMore,
    reload,
  };
};

export default useProductReviews;
