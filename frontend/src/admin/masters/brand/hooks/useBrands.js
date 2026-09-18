import { useCallback, useEffect, useState } from 'react';
import * as brandApi from '../api/brandApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the brands list state for the admin page: fetching, and the
 * create/update/delete/toggle mutations, each surfacing errors via toast
 * rather than throwing, so callers can just check the boolean result.
 */
export const useBrands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await brandApi.getAllBrandsAdmin();
      setBrands(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load brands');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const createBrand = async (payload) => {
    setMutating(true);
    try {
      await brandApi.addBrand(payload);
      toast.success('Brand added successfully');
      await fetchBrands();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to add brand');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editBrand = async (brandId, payload) => {
    setMutating(true);
    try {
      await brandApi.updateBrand({ brandId, ...payload });
      toast.success('Brand updated successfully');
      await fetchBrands();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update brand');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeBrand = async (brandId) => {
    setMutating(true);
    try {
      await brandApi.deleteBrand(brandId);
      toast.success('Brand deleted successfully');
      await fetchBrands();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete brand');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = (brand) => {
    const nextStatus = brand.status === 'A' ? 'I' : 'A';
    return editBrand(brand._id, { status: nextStatus });
  };

  // Surfaces a { results, successCount, failureCount } bulk response as a
  // single toast - success if everything went through, a warning naming the
  // partial count when some items failed, or an error if none did.
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} brand(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected brand(s)`);
    } else {
      toast.warning(`${successCount} brand(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (brandIds, status) => {
    if (!brandIds || brandIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await brandApi.bulkSetBrandStatus(brandIds, status);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      await fetchBrands();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update brand status');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveBrands = async (brandIds) => {
    if (!brandIds || brandIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await brandApi.bulkDeleteBrands(brandIds);
      describeBulkOutcome(data, 'deleted');
      await fetchBrands();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete brands');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    brands,
    loading,
    error,
    mutating,
    refetch: fetchBrands,
    createBrand,
    editBrand,
    removeBrand,
    toggleStatus,
    bulkToggleStatus,
    bulkRemoveBrands,
  };
};

export default useBrands;
