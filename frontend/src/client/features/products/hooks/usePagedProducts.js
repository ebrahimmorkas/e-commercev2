import { useCallback, useEffect, useRef, useState } from 'react';
import { shapeProductForCard } from '../utils/shapeProduct';
import { loadCategoryNameMap } from '../utils/categoryNames';

const EMPTY_LIST = { key: null, products: [], pagination: null, extra: {}, error: null, statusCode: null };
const IDLE_MORE = { key: null, loading: false, error: null };

/**
 * One server-paginated product list, shaped for cards, grown a page at a
 * time with loadMore() - the "Load more" button pattern, not endless
 * auto-scroll, so the footer stays reachable however many products exist.
 *
 * Starts over whenever `resetKey` changes (a new search, sort or category)
 * or reload() is called. Every result is stored with the request it answers,
 * so a slow earlier response can never overwrite newer results, and
 * "loading" simply means "no result for the current request yet".
 *
 * @param {Object} options
 * @param {(page: number) => Promise<Object>} options.fetchPage - Resolves to { products, pagination, ...extra }.
 * @param {string} options.resetKey
 * @param {boolean} [options.enabled=true]
 * @returns {{ products, total, hasMore, extra, loading, loadingMore, error, statusCode, loadMoreError, loadMore, reload }}
 */
export const usePagedProducts = ({ fetchPage, resetKey, enabled = true }) => {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${resetKey}#${reloadCount}`;
  const [list, setList] = useState(EMPTY_LIST);
  const [more, setMore] = useState(IDLE_MORE);

  // Always the latest fetchPage, without refetching on every render. Declared
  // before the fetch effect below, so it's current when that runs.
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  const fetchShaped = useCallback(async (page) => {
    const [result, categoryNameById] = await Promise.all([fetchPageRef.current(page), loadCategoryNameMap()]);
    const { products: rawProducts = [], pagination = null, ...extra } = result || {};
    return { products: rawProducts.map((p) => shapeProductForCard(p, categoryNameById)), pagination, extra };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchShaped(1)
      .then(({ products, pagination, extra }) => {
        if (!cancelled) setList({ key: requestKey, products, pagination, extra, error: null, statusCode: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setList({ ...EMPTY_LIST, key: requestKey, error: err.message || 'Failed to load products', statusCode: err.statusCode ?? null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, enabled, fetchShaped]);

  const loading = list.key !== requestKey;
  const current = loading ? EMPTY_LIST : list;
  const loadingMore = more.key === requestKey && more.loading;

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !current.pagination?.hasMore) return;
    const keyAtStart = requestKey;
    setMore({ key: keyAtStart, loading: true, error: null });
    try {
      const { products, pagination } = await fetchShaped(current.pagination.page + 1);
      setList((prev) => {
        if (prev.key !== keyAtStart) return prev;
        // A product added/removed between two page requests shifts the pages,
        // so the next page can repeat a product already shown - skip those.
        const seen = new Set(prev.products.map((p) => p.id));
        return { ...prev, products: [...prev.products, ...products.filter((p) => !seen.has(p.id))], pagination };
      });
      setMore((prev) => (prev.key === keyAtStart ? IDLE_MORE : prev));
    } catch (err) {
      setMore((prev) => (prev.key === keyAtStart ? { key: keyAtStart, loading: false, error: err.message || 'Could not load more products' } : prev));
    }
  }, [loading, loadingMore, current.pagination, requestKey, fetchShaped]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    products: current.products,
    total: current.pagination?.total ?? 0,
    hasMore: !!current.pagination?.hasMore,
    extra: current.extra,
    loading: enabled && loading,
    loadingMore,
    error: current.error,
    statusCode: current.statusCode,
    loadMoreError: more.key === requestKey ? more.error : null,
    loadMore,
    reload,
  };
};

export default usePagedProducts;
