import { useCallback, useEffect, useState } from 'react';
import * as productApi from '../api/productApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the admin product list state and its mutations, mirroring
 * admin/masters/category/hooks/useCategories.js: every mutation surfaces
 * errors via toast (including any Joi field errors from the backend) and
 * refetches the list afterwards rather than trying to patch it locally.
 */
export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const describeError = (err) => {
    if (err.errors && err.errors.length > 0) {
      return err.errors.map((e) => e.message).join(' ');
    }
    return err.message || 'Something went wrong';
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await productApi.getProductsAdmin();
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      setError(describeError(err));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
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
      await fetchProducts();
      return data;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    products,
    loading,
    error,
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
  };
};

export default useProducts;
