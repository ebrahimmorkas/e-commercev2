import { useCallback, useEffect, useRef, useState } from 'react';
import * as freeCashUsageApi from '../api/freeCashUsageApi';
import { FREE_CASH_USAGE_PAGE_SIZE } from '../constants';

const SEARCH_DEBOUNCE_MS = 350;

const describeError = (err) => {
  if (err.errors && err.errors.length > 0) {
    return err.errors.map((e) => e.message).join(' ');
  }
  return err.message || 'Something went wrong';
};

/**
 * Owns the Free Cash Usage customer list: paginated, searched, filtered (by
 * account status and by an active Free Cash range) and sorted on the server.
 * While another page loads, the previous rows stay on screen (`loading` is
 * true) instead of the table blanking out. Read-only - there are no mutations.
 */
export const useFreeCashUsage = () => {
  // What the admin typed (instant) vs. what the server is asked for (debounced).
  const [searchText, setSearchTextState] = useState('');
  const [params, setParams] = useState({
    page: 1,
    search: '',
    minAmount: '',
    maxAmount: '',
    customerStatus: 'ALL',
    sort: 'NAME',
  });
  const requestKey = `${params.page}|${params.search}|${params.minAmount}|${params.maxAmount}|${params.customerStatus}|${params.sort}`;
  const [result, setResult] = useState({ key: null, customers: [], pagination: null, summary: null, error: '' });
  const searchTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    freeCashUsageApi
      .getCustomersFreeCash({ ...params, limit: FREE_CASH_USAGE_PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          customers: Array.isArray(data?.customers) ? data.customers : [],
          pagination: data?.pagination || null,
          summary: data?.summary || null,
          error: '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult((prev) => ({ ...prev, key: requestKey, customers: [], pagination: null, error: describeError(err) }));
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey covers every param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  const setSearchText = useCallback((text) => {
    setSearchTextState(text);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(
      () => setParams((prev) => ({ ...prev, page: 1, search: text.trim() })),
      text ? SEARCH_DEBOUNCE_MS : 0
    );
  }, []);

  const setPage = useCallback((page) => setParams((prev) => ({ ...prev, page })), []);
  const setCustomerStatus = useCallback(
    (customerStatus) => setParams((prev) => ({ ...prev, page: 1, customerStatus: customerStatus || 'ALL' })),
    []
  );
  const setSort = useCallback((sort) => setParams((prev) => ({ ...prev, page: 1, sort: sort || 'NAME' })), []);
  // '' on either end leaves that end of the range open.
  const setAmountRange = useCallback(
    (minAmount, maxAmount) => setParams((prev) => ({ ...prev, page: 1, minAmount, maxAmount })),
    []
  );

  return {
    customers: result.customers,
    pagination: result.pagination,
    summary: result.summary,
    error: result.error,
    loading: result.key !== requestKey,
    // True until the very first response - the page shows a spinner instead of an empty table.
    initialLoading: result.key === null,
    page: params.page,
    customerStatus: params.customerStatus,
    sort: params.sort,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    searchText,
    isFiltered:
      params.search !== '' || params.minAmount !== '' || params.maxAmount !== '' || params.customerStatus !== 'ALL',
    setSearchText,
    setPage,
    setCustomerStatus,
    setSort,
    setAmountRange,
  };
};

export default useFreeCashUsage;
