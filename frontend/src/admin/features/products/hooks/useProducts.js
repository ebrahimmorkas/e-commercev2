import { useCallback, useEffect, useRef, useState } from 'react';
import * as productApi from '../api/productApi';
import { useToast } from '../../../../components/common/Toast';

export const ADMIN_PRODUCTS_PAGE_SIZE = 20;
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
 * The list is paginated and searched on the server (GET
 * /products/get-products-admin?page&limit&q), so only one page of products
 * is ever in memory - the page stays fast however big the catalogue is.
 * While another page or search loads, the previous rows stay on screen
 * (`loading` is true) instead of the table blanking out.
 */
export const useProducts = () => {
  // What the admin typed (instant) vs. what the server is asked for (debounced).
  const [searchText, setSearchTextState] = useState('');
  const [params, setParams] = useState({ page: 1, q: '' });
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${params.page}|${params.q}|${reloadToken}`;
  const [result, setResult] = useState({ key: null, products: [], pagination: null, error: '' });
  // Size of the whole catalogue (last unsearched total), for "12 of 10,014 products".
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [mutating, setMutating] = useState(false);
  const searchTimerRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    productApi
      .getProductsAdmin({ page: params.page, limit: ADMIN_PRODUCTS_PAGE_SIZE, q: params.q })
      .then((data) => {
        if (cancelled) return;
        const pagination = data?.pagination || null;
        setResult({ key: requestKey, products: Array.isArray(data?.products) ? data.products : [], pagination, error: '' });
        if (!params.q && pagination) setCatalogTotal(pagination.total);
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
    searchTimerRef.current = setTimeout(() => setParams({ page: 1, q: text.trim() }), text ? SEARCH_DEBOUNCE_MS : 0);
  }, []);

  const setPage = useCallback((page) => setParams((prev) => ({ ...prev, page })), []);

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

  // Excel bulk upload. Resolves to { success, result } - result is the per-row
  // outcome (totalRows/successCount/failedCount/failedRecords) for the caller to render.
  const runBulkUpload = async (excelFile, mainImagesZip, additionalImagesZip) => {
    setMutating(true);
    try {
      const data = await productApi.bulkUploadProducts(excelFile, mainImagesZip, additionalImagesZip);
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
    searchText,
    setSearchText,
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
  };
};

export default useProducts;
