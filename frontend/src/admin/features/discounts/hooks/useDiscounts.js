import { useCallback, useEffect, useState } from 'react';
import * as discountApi from '../api/discountApi';
import { useToast } from '../../../../components/common/Toast';

// A failed request's most useful message: the first field error of a
// 'Validation failed' response, else the message itself.
const errorMessage = (err, fallback) => {
  const firstFieldError = Array.isArray(err?.errors) ? err.errors.find((e) => e && e.message) : null;
  if (firstFieldError) return firstFieldError.message;
  return err?.message || fallback;
};

/**
 * Owns the discounts list state for the admin page: fetching, and the
 * create/update/delete/toggle mutations, each surfacing errors via toast
 * rather than throwing, so callers can just check the boolean result. Every
 * mutation refetches the full list afterwards rather than patching local
 * state, mirroring admin/masters/category/hooks/useCategories.js.
 */
export const useDiscounts = () => {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await discountApi.getAdminDiscounts();
      setDiscounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load discounts');
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const fetchDiscountById = async (discountId) => {
    try {
      return await discountApi.getDiscountById(discountId);
    } catch (err) {
      toast.error(err.message || 'Failed to load discount');
      return null;
    }
  };

  const createDiscount = async (fields, excelFile) => {
    setMutating(true);
    try {
      const result = await discountApi.addDiscount(fields, excelFile);
      toast.success('Discount created successfully');
      await fetchDiscounts();
      return { success: true, excelReports: result?.excelReports };
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create discount'));
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  const editDiscount = async (discountId, fields, excelFile) => {
    setMutating(true);
    try {
      const result = await discountApi.updateDiscount(discountId, fields, excelFile);
      toast.success('Discount updated successfully');
      await fetchDiscounts();
      return { success: true, excelReports: result?.excelReports };
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update discount'));
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  const removeDiscount = async (discountId) => {
    setMutating(true);
    try {
      await discountApi.deleteDiscount(discountId);
      toast.success('Discount deleted successfully');
      await fetchDiscounts();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete discount');
      return false;
    } finally {
      setMutating(false);
    }
  };

  // A single row's Active/Inactive switch - the same minimal status flip as
  // the bulk action (discountService's setDiscountStatusForBulk), so it works
  // for every discount, including excel-targeted ones, and never re-validates
  // the rest of the discount. notifyCustomers: when re-activating, email its customers again.
  const toggleStatus = async (discount, notifyCustomers = false) => {
    const status = discount.status === 'A' ? 'I' : 'A';
    setMutating(true);
    try {
      const data = await discountApi.bulkSetDiscountStatus([discount._id], status, status === 'A' && notifyCustomers);
      const failed = (data?.results || []).find((r) => !r.isSuccess);
      if (failed) {
        toast.error(failed.message || 'Failed to update discount status');
        return false;
      }
      toast.success(status === 'A' ? 'Discount activated' : 'Discount deactivated');
      await fetchDiscounts();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update discount status'));
      return false;
    } finally {
      setMutating(false);
    }
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} discount(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      const firstFailure = (data?.results || []).find((r) => !r.isSuccess);
      toast.error(firstFailure?.message || `Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected discount(s)`);
    } else {
      toast.warning(`${successCount} discount(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (discountIds, status, notifyCustomers = false) => {
    if (!discountIds || discountIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await discountApi.bulkSetDiscountStatus(discountIds, status, notifyCustomers);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      await fetchDiscounts();
      return data;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update discount status'));
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveDiscounts = async (discountIds) => {
    if (!discountIds || discountIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await discountApi.bulkDeleteDiscounts(discountIds);
      describeBulkOutcome(data, 'deleted');
      await fetchDiscounts();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete discounts');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    discounts,
    loading,
    error,
    mutating,
    refetch: fetchDiscounts,
    fetchDiscountById,
    createDiscount,
    editDiscount,
    removeDiscount,
    toggleStatus,
    bulkToggleStatus,
    bulkRemoveDiscounts,
  };
};

export default useDiscounts;
