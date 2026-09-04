import { useCallback, useEffect, useState } from 'react';
import * as discountApi from '../api/discountApi';
import { useToast } from '../../../../components/common/Toast';
import { mapApiDiscountToDraft, buildSubmitFields, needsExcelFor } from '../utils/discountDraft';

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
      toast.error(err.message || 'Failed to create discount');
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
      toast.error(err.message || 'Failed to update discount');
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

  /**
   * updateDiscount always re-validates and re-resolves the full targeting
   * payload (see discountService.updateDiscount), so a status flip can't be
   * a lightweight PATCH - it resends every field, reconstructed from the
   * list row (which already carries the full doc). That's only possible when
   * giveDiscountTo doesn't depend on a re-uploaded excel file; otherwise the
   * caller is directed to the edit form instead.
   */
  const toggleStatus = async (discount) => {
    if (needsExcelFor(discount.giveDiscountTo)) {
      toast.error('This discount\'s targeting was set via an excel upload - open Edit and re-upload the file to change its status.');
      return false;
    }
    const draft = mapApiDiscountToDraft(discount);
    draft.status = discount.status === 'A' ? 'I' : 'A';
    const fields = buildSubmitFields(draft, { includeStatus: true });
    const result = await editDiscount(discount._id, fields, null);
    return result.success;
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
  };
};

export default useDiscounts;
