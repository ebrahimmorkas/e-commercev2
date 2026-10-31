import { useCallback, useEffect, useRef, useState } from 'react';
import * as productApi from '../api/productApi';
import { useToast } from '../../../../components/common/Toast';
import { saveBlob } from '../../../../utils/saveBlob';
import { DEFAULT_PRODUCT_SORT, EMPTY_PRODUCT_FILTERS, countActiveFilters, toProductFilterParams } from '../utils/productListFilters';

const SEARCH_DEBOUNCE_MS = 350;

const describeError = (err) => {
  if (err.errors && err.errors.length > 0) {
    return err.errors.map((e) => e.message).join(' ');
  }
  return err.message || 'Something went wrong';
};

/**
 * Owns the admin product list state and its mutations, mirroring
 * admin/masters/category/hooks/useCategories.js: every mutation surfaces
 * errors via toast (including any Joi field errors from the backend) and
 * refetches the list afterwards rather than trying to patch it locally.
 *
 * The list is paginated, searched, filtered and sorted on the server (GET
 * /products/get-products-admin?page&limit&q&sort&categoryId&minPrice&maxPrice&stockStatus),
 * so only one page of products is ever in memory - the page stays fast
 * however big the catalogue is.
 * While another page or search loads, the previous rows stay on screen
 * (`loading` is true) instead of the table blanking out.
 */
export const useProducts = () => {
  // What the admin typed (instant) vs. what the server is asked for (debounced).
  const [searchText, setSearchTextState] = useState('');
  // limit null = the vendor's default page size - the server fills it in, so
  // the first load needs no Company Settings round trip. A pick on the page
  // only lasts for this visit.
  const [params, setParams] = useState({ page: 1, q: '', sort: DEFAULT_PRODUCT_SORT, filters: EMPTY_PRODUCT_FILTERS, limit: null });
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${JSON.stringify(params)}|${reloadToken}`;
  const [result, setResult] = useState({ key: null, products: [], pagination: null, error: '' });
  // Size of the whole catalogue (last unsearched, unfiltered total), for "12 of 10,014 products".
  const [catalogTotal, setCatalogTotal] = useState(0);
  // Total stock at or below this (and above 0) is "Low stock" - sent by the server with every page.
  const [lowStockThreshold, setLowStockThreshold] = useState(null);
  const activeFilterCount = countActiveFilters(params.filters);
  const [mutating, setMutating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchTimerRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    productApi
      .getProductsAdmin({
        page: params.page,
        limit: params.limit || undefined,
        q: params.q,
        sort: params.sort,
        ...toProductFilterParams(params.filters),
      })
      .then((data) => {
        if (cancelled) return;
        const pagination = data?.pagination || null;
        setResult({ key: requestKey, products: Array.isArray(data?.products) ? data.products : [], pagination, error: '' });
        if (!params.q && countActiveFilters(params.filters) === 0 && pagination) setCatalogTotal(pagination.total);
        if (typeof data?.lowStockThreshold === 'number') setLowStockThreshold(data.lowStockThreshold);
      })
      .catch((err) => {
        if (!cancelled) setResult({ key: requestKey, products: [], pagination: null, error: describeError(err) });
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
    searchTimerRef.current = setTimeout(() => setParams((prev) => ({ ...prev, page: 1, q: text.trim() })), text ? SEARCH_DEBOUNCE_MS : 0);
  }, []);

  // A new sort or filter always starts again from page 1.
  const setSort = useCallback((sort) => setParams((prev) => ({ ...prev, page: 1, sort: sort || DEFAULT_PRODUCT_SORT })), []);
  const setFilters = useCallback((filters) => setParams((prev) => ({ ...prev, page: 1, filters: { ...EMPTY_PRODUCT_FILTERS, ...filters } })), []);
  const clearFilters = useCallback(() => setParams((prev) => ({ ...prev, page: 1, filters: EMPTY_PRODUCT_FILTERS })), []);

  const setPage = useCallback((page) => setParams((prev) => ({ ...prev, page })), []);
  const setPageSize = useCallback((limit) => setParams((prev) => ({ ...prev, page: 1, limit: Number(limit) || null })), []);

  // Reloads the current page. A page emptied by a delete steps back one page.
  const fetchProducts = useCallback(() => setReloadToken((token) => token + 1), []);
  const refetchAfterRemoving = (removedCount) => {
    const remaining = result.products.length - removedCount;
    if (remaining <= 0 && params.page > 1) setPage(params.page - 1);
    else fetchProducts();
  };

  const fetchProductById = async (id) => {
    try {
      const data = await productApi.getProductByIdAdmin(id);
      return data?.product || null;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    }
  };

  const createProduct = async (payload, mainImages, additionalImageUploads) => {
    setMutating(true);
    try {
      await productApi.createProduct(payload, mainImages, additionalImageUploads);
      toast.success('Product created successfully');
      fetchProducts();
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editProduct = async (payload, mainImages, additionalImageUploads) => {
    setMutating(true);
    try {
      await productApi.updateProduct(payload, mainImages, additionalImageUploads);
      toast.success('Product updated successfully');
      fetchProducts();
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeProduct = async (productId) => {
    setMutating(true);
    try {
      await productApi.deleteProduct(productId);
      toast.success('Product deleted successfully');
      refetchAfterRemoving(1);
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = async (product) => {
    const nextStatus = product.status === 'A' ? 'I' : 'A';
    setMutating(true);
    try {
      await productApi.toggleProductStatus(product._id, nextStatus);
      toast.success(`Product marked ${nextStatus === 'A' ? 'active' : 'inactive'}`);
      fetchProducts();
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  const cloneProduct = async (productId) => {
    setMutating(true);
    try {
      await productApi.cloneProduct(productId);
      toast.success('Product cloned successfully');
      fetchProducts();
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setMutating(false);
    }
  };

  // Surfaces a { results, successCount, failureCount } bulk response as a
  // single toast - success if everything went through, a warning naming the
  // partial count when some items failed (e.g. a plan cap reached mid-batch),
  // or an error if none did.
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} product(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : pastTenseVerb === 'cloned' ? 'clone' : 'update'} the selected product(s)`);
    } else {
      toast.warning(`${successCount} product(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (productIds, status) => {
    if (!productIds || productIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await productApi.bulkSetProductStatus(productIds, status);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      fetchProducts();
      return data;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveProducts = async (productIds) => {
    if (!productIds || productIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await productApi.bulkDeleteProducts(productIds);
      describeBulkOutcome(data, 'deleted');
      refetchAfterRemoving(data?.successCount ?? 0);
      return data;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkCloneProductsAction = async (productIds) => {
    if (!productIds || productIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await productApi.bulkCloneProducts(productIds);
      describeBulkOutcome(data, 'cloned');
      fetchProducts();
      return data;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setMutating(false);
    }
  };

  // Download: what the list shows right now (search + filters + sort, every
  // page), or just `selectedIds` when products are ticked.
  const exportProducts = async (selectedIds = []) => {
    setExporting(true);
    try {
      const data = await productApi.exportProducts({
        ids: selectedIds,
        q: params.q,
        sort: params.sort,
        ...toProductFilterParams(params.filters),
      });
      saveBlob(data.blob, data.filename || 'products.zip');
      if (data.failedImageCount > 0 || data.failedVideoCount > 0) {
        const missing = [
          data.failedImageCount > 0 ? `${data.failedImageCount} image(s)` : null,
          data.failedVideoCount > 0 ? `${data.failedVideoCount} video(s)` : null,
        ].filter(Boolean).join(' and ');
        toast.warning(`${data.productCount} product(s) downloaded, but ${missing} could not be included - see the Instructions sheet.`);
      } else {
        toast.success(`${data.productCount} product(s) downloaded`);
      }
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setExporting(false);
    }
  };

  // Excel bulk upload. Resolves to { success, result } - result is the per-row
  // outcome (totalRows/successCount/failedCount/failedRecords) for the caller to render.
  const runBulkUpload = async (excelFile, mainImagesZip, additionalImagesZip, videosZip) => {
    setMutating(true);
    try {
      const data = await productApi.bulkUploadProducts(excelFile, mainImagesZip, additionalImagesZip, videosZip);
      if (data?.successCount > 0) fetchProducts();
      return { success: true, result: data };
    } catch (err) {
      toast.error(describeError(err));
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  return {
    products: result.products,
    pagination: result.pagination,
    catalogTotal,
    page: params.page,
    setPage,
    // What's on screen: the admin's pick, else the page size the server used.
    pageSize: params.limit || result.pagination?.limit || null,
    setPageSize,
    searchText,
    setSearchText,
    sort: params.sort,
    setSort,
    filters: params.filters,
    setFilters,
    clearFilters,
    activeFilterCount,
    lowStockThreshold,
    loading,
    initialLoading: loading && result.key === null,
    error: result.error,
    mutating,
    refetch: fetchProducts,
    fetchProductById,
    createProduct,
    editProduct,
    removeProduct,
    toggleStatus,
    cloneProduct,
    bulkToggleStatus,
    bulkRemoveProducts,
    bulkCloneProducts: bulkCloneProductsAction,
    runBulkUpload,
    exportProducts,
    exporting,
  };
};

export default useProducts;
