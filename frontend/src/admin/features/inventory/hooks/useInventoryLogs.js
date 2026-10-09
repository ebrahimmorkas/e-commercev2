import { useCallback, useEffect, useRef, useState } from 'react';
import * as inventoryApi from '../api/inventoryApi';
import { INVENTORY_LOG_PAGE_SIZE } from '../constants';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Stock history, paginated / searched / filtered on the server.
 *
 * @param {Object} [options]
 * @param {string} [options.sizeId] - Only this product size's history (the row's "History" action)
 * @param {*} [options.refreshKey] - Change it to reload (e.g. after a stock adjustment)
 */
export const useInventoryLogs = ({ sizeId = '', refreshKey = 0 } = {}) => {
  const [searchText, setSearchTextState] = useState('');
  const [params, setParams] = useState({ page: 1, search: '', type: '' });
  const requestKey = `${sizeId}|${params.page}|${params.search}|${params.type}|${refreshKey}`;
  const [result, setResult] = useState({ key: null, logs: [], pagination: null, error: '' });
  const searchTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    inventoryApi
      .getInventoryLogs({
        page: params.page,
        limit: INVENTORY_LOG_PAGE_SIZE,
        search: params.search,
        type: params.type,
        sizeId,
      })
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          logs: Array.isArray(data?.logs) ? data.logs : [],
          pagination: data?.pagination || null,
          error: '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({ key: requestKey, logs: [], pagination: null, error: err.message || 'Failed to load stock history' });
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey covers sizeId, params and refreshKey.
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
  const setType = useCallback((type) => setParams((prev) => ({ ...prev, page: 1, type: type || '' })), []);

  return {
    logs: result.logs,
    pagination: result.pagination,
    error: result.error,
    loading: result.key !== requestKey,
    page: params.page,
    type: params.type,
    searchText,
    isFiltering: params.search !== '' || params.type !== '',
    setSearchText,
    setPage,
    setType,
  };
};

export default useInventoryLogs;
