import { useCallback, useEffect, useRef, useState } from 'react';
import * as inventoryApi from '../api/inventoryApi';
import { useToast } from '../../../../components/common/Toast';
import { INVENTORY_PAGE_SIZE, STOCK_OPERATIONS } from '../constants';

const SEARCH_DEBOUNCE_MS = 350;

const describeError = (err) => {
  if (err.errors && err.errors.length > 0) {
    return err.errors.map((e) => e.message).join(' ');
  }
  return err.message || 'Something went wrong';
};

/**
 * Owns the Inventory list (one row per product size) and its stock
 * adjustments, mirroring admin/features/products/hooks/useProducts.js: the
 * list is paginated, searched, filtered and sorted on the server, and every
 * adjustment surfaces its outcome via toast and refetches the page rather
 * than patching it locally. While another page loads, the previous rows stay
 * on screen (`loading` is true) instead of the table blanking out.
 */
export const useInventory = () => {
  // What the admin typed (instant) vs. what the server is asked for (debounced).
  const [searchText, setSearchTextState] = useState('');
  const [params, setParams] = useState({ page: 1, search: '', stockFilter: 'ALL', sort: 'NAME' });
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${params.page}|${params.search}|${params.stockFilter}|${params.sort}|${reloadToken}`;
  const [result, setResult] = useState({ key: null, items: [], pagination: null, summary: null, lowStock: null, error: '' });
  const [mutating, setMutating] = useState(false);
  const searchTimerRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    inventoryApi
      .getInventory({
        page: params.page,
        limit: INVENTORY_PAGE_SIZE,
        search: params.search,
        stockFilter: params.stockFilter,
        sort: params.sort,
      })
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          items: Array.isArray(data?.items) ? data.items : [],
          pagination: data?.pagination || null,
          summary: data?.summary || null,
          lowStock: data?.lowStock || null,
          error: '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult((prev) => ({ ...prev, key: requestKey, items: [], pagination: null, error: describeError(err) }));
        }
      });
    return () => {
      cancelled = true;
    };
    // requestKey covers params and reloadToken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  const loading = result.key !== requestKey;

  const setSearchText = useCallback((text) => {
    setSearchTextState(text);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(
      () => setParams((prev) => ({ ...prev, page: 1, search: text.trim() })),
      text ? SEARCH_DEBOUNCE_MS : 0
    );
  }, []);

  const setPage = useCallback((page) => setParams((prev) => ({ ...prev, page })), []);
  const setStockFilter = useCallback(
    (stockFilter) => setParams((prev) => ({ ...prev, page: 1, stockFilter: stockFilter || 'ALL' })),
    []
  );
  const setSort = useCallback((sort) => setParams((prev) => ({ ...prev, page: 1, sort: sort || 'NAME' })), []);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * One product size.
   * @param {Object} item - The Inventory row
   * @param {{ operation: 'INCREASE'|'DEDUCT', quantity: number, remark: string }} change
   * @returns {Promise<boolean>}
   */
  const adjustStock = async (item, { operation, quantity, remark }) => {
    setMutating(true);
    try {
      const data = await inventoryApi.adjustStock({
        productId: item.productId,
        variantId: item.variantId,
        sizeId: item.sizeId,
        operation,
        quantity,
        remark,
      });
      const verb = operation === STOCK_OPERATIONS.INCREASE ? 'increased' : 'deducted';
      toast.success(`Stock ${verb}. ${item.productName} now has ${data?.newStock ?? '—'} in stock.`);
      refetch();
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  /**
   * The same quantity on every selected product size. Resolves to the
   * { results, successCount, failureCount } response, or null if the request
   * itself failed.
   * @param {Object[]} items - The selected Inventory rows
   * @param {{ operation: 'INCREASE'|'DEDUCT', quantity: number, remark: string }} change
   */
  const bulkAdjustStock = async (items, { operation, quantity, remark }) => {
    if (!items || items.length === 0) return null;
    setMutating(true);
    try {
      const data = await inventoryApi.bulkAdjustStock({
        items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, sizeId: item.sizeId })),
        operation,
        quantity,
        remark,
      });
      const verb = operation === STOCK_OPERATIONS.INCREASE ? 'increased' : 'deducted';
      const successCount = data?.successCount ?? 0;
      const failureCount = data?.failureCount ?? 0;
      if (failureCount === 0) {
        toast.success(`Stock ${verb} for ${successCount} item(s)`);
      } else if (successCount === 0) {
        toast.error(`Stock could not be ${verb} for the selected item(s)`);
      } else {
        toast.warning(`Stock ${verb} for ${successCount} item(s), ${failureCount} could not be changed`);
      }
      refetch();
      return data;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    items: result.items,
    pagination: result.pagination,
    summary: result.summary,
    lowStock: result.lowStock,
    error: result.error,
    loading,
    // True until the very first response - the page shows a spinner instead of an empty table.
    initialLoading: result.key === null,
    mutating,
    page: params.page,
    stockFilter: params.stockFilter,
    sort: params.sort,
    searchText,
    isSearching: params.search !== '',
    setSearchText,
    setPage,
    setStockFilter,
    setSort,
    refetch,
    adjustStock,
    bulkAdjustStock,
  };
};

export default useInventory;
