import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as reviewAdminApi from '../api/reviewAdminApi';
import { useRealtime } from '../../../realtime/useRealtime';
import { useToast } from '../../../../components/common/Toast';
import { PAGE_SIZE, REVIEWS_REALTIME_MODULE } from '../constants';

const DEFAULT_FILTERS = { status: 'all', search: '', rating: '', fromDate: '', toDate: '', sort: 'pendingFirst' };
const EMPTY_COUNTS = { all: 0, pending: 0, approved: 0, rejected: 0, deleted: 0 };

/**
 * The admin Reviews list: filters, server-side paging, tab counts, the
 * account's permissions (edit / approve-reject), the bulk actions, and live
 * updates - a customer posting/editing/deleting a review re-reads the list
 * quietly (and a review waiting for approval raises a toast).
 *
 * Each answer is tagged with the query it belongs to, so `loading` is derived
 * and a late answer for an older query is dropped.
 */
export const useAdminReviews = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ key: null, reviews: [], counts: EMPTY_COUNTS, permissions: null, pagination: null, error: '' });
  const [busy, setBusy] = useState(false);
  const { subscribe } = useRealtime();
  // useToast() hands back a new object every render - kept in a ref so the
  // realtime subscription and actions don't change identity with it.
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });

  // Typing in the search box waits a moment before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchText.trim() ? prev : { ...prev, search: searchText.trim() }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = useMemo(
    () => ({ ...filters, rating: filters.rating || undefined, page, limit: PAGE_SIZE }),
    [filters, page]
  );
  const queryKey = JSON.stringify(query);
  const key = `${queryKey}|${refreshKey}`;

  useEffect(() => {
    const controller = new AbortController();
    reviewAdminApi
      .getAdminReviews(JSON.parse(queryKey), { signal: controller.signal })
      .then((data) => {
        setResult({
          key,
          reviews: data?.reviews || [],
          counts: { ...EMPTY_COUNTS, ...(data?.counts || {}) },
          permissions: data?.permissions || null,
          pagination: data?.pagination || null,
          error: '',
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setResult((prev) => ({ ...prev, key, error: err?.message || 'Failed to load reviews' }));
      });
    return () => controller.abort();
  }, [queryKey, key]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(
    () =>
      subscribe(REVIEWS_REALTIME_MODULE, (payload) => {
        refresh();
        if (payload?.type === 'NEW' && payload?.data?.moderationStatus === 'PENDING') {
          toastRef.current.info(`New review${payload.data.productName ? ` for ${payload.data.productName}` : ''} is waiting for approval`);
        }
      }),
    [subscribe, refresh]
  );

  const setFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchText('');
    setPage(1);
  }, []);

  // Runs one of the bulk actions; resolves true on success.
  const runAction = useCallback(
    async (action) => {
      setBusy(true);
      try {
        const data = await action();
        toastRef.current.success(data?.message || 'Done');
        refresh();
        return true;
      } catch (err) {
        toastRef.current.error(err?.message || 'Something went wrong');
        refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const isCurrent = result.key === key;

  return {
    filters,
    setFilter,
    resetFilters,
    searchText,
    setSearchText,
    page,
    setPage,
    reviews: result.reviews,
    counts: result.counts,
    permissions: result.permissions,
    pagination: result.pagination,
    error: isCurrent ? result.error : '',
    loading: !isCurrent,
    busy,
    refresh,
    approve: (ids) => runAction(() => reviewAdminApi.approveReviews(ids)),
    reject: (ids, reason) => runAction(() => reviewAdminApi.rejectReviews(ids, reason)),
    remove: (ids) => runAction(() => reviewAdminApi.deleteReviews(ids)),
  };
};

export default useAdminReviews;
