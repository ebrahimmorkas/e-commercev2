import { useCallback, useEffect, useState } from 'react';
import * as freeCashApi from '../api/freeCashApi';
import { useToast } from '../../../../components/common/Toast';

// A failed request's most useful message: the first field error of a
// 'Validation failed' response, else the message itself.
const errorMessage = (err, fallback) => {
  const firstFieldError = Array.isArray(err?.errors) ? err.errors.find((e) => e && e.message) : null;
  if (firstFieldError) return firstFieldError.message;
  return err?.message || fallback;
};

/**
 * Owns the Free Cash list state for the admin page: fetching, and the
 * create/update/delete/toggle/revoke mutations, each surfacing errors via
 * toast rather than throwing, so callers can just check the boolean result.
 * Every mutation refetches the full list afterwards rather than patching
 * local state, mirroring admin/features/discounts/hooks/useDiscounts.js.
 */
export const useFreeCash = () => {
  const [freeCashList, setFreeCashList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchFreeCash = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await freeCashApi.getAdminFreeCash();
      setFreeCashList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load Free Cash campaigns');
      setFreeCashList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFreeCash();
  }, [fetchFreeCash]);

  const fetchFreeCashById = async (freeCashId) => {
    try {
      return await freeCashApi.getFreeCashById(freeCashId);
    } catch (err) {
      toast.error(err.message || 'Failed to load Free Cash campaign');
      return null;
    }
  };

  const createFreeCash = async (fields, excelFile) => {
    setMutating(true);
    try {
      const result = await freeCashApi.addFreeCash(fields, excelFile);
      toast.success('Free Cash campaign created successfully');
      await fetchFreeCash();
      return { success: true, excelReports: result?.excelReports, issuedCount: result?.issuedCount };
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create Free Cash campaign'));
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  const editFreeCash = async (freeCashId, fields, excelFile) => {
    setMutating(true);
    try {
      const result = await freeCashApi.updateFreeCash(freeCashId, fields, excelFile);
      const changes = [
        result?.issuedCount ? `given to ${result.issuedCount} more customer(s)` : '',
        result?.revokedCount ? `unused balance removed from ${result.revokedCount} customer(s)` : '',
      ].filter(Boolean);
      toast.success(`Free Cash campaign updated successfully${changes.length ? ` - ${changes.join(', ')}` : ''}`);
      await fetchFreeCash();
      return { success: true, excelReports: result?.excelReports };
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update Free Cash campaign'));
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  const removeFreeCash = async (freeCashId) => {
    setMutating(true);
    try {
      await freeCashApi.deleteFreeCash(freeCashId);
      toast.success('Free Cash campaign deleted successfully');
      await fetchFreeCash();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete Free Cash campaign');
      return false;
    } finally {
      setMutating(false);
    }
  };

  // A single row's Active/Inactive switch - the same minimal status flip as
  // the bulk action (freeCashService's setFreeCashStatusForBulk), so it works
  // for every campaign, excel-targeted ones included, and never re-validates
  // the rest of the campaign. notifyCustomers: when re-activating, email its customers again.
  const toggleStatus = async (freeCash, notifyCustomers = false) => {
    const status = freeCash.status === 'A' ? 'I' : 'A';
    setMutating(true);
    try {
      const data = await freeCashApi.bulkSetFreeCashStatus([freeCash._id], status, status === 'A' && notifyCustomers);
      const failed = (data?.results || []).find((r) => !r.isSuccess);
      if (failed) {
        toast.error(failed.message || 'Failed to update Free Cash status');
        return false;
      }
      toast.success(status === 'A' ? 'Free Cash campaign activated' : 'Free Cash campaign deactivated');
      await fetchFreeCash();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update Free Cash status'));
      return false;
    } finally {
      setMutating(false);
    }
  };

  const revokeForUser = async (email, freeCashId) => {
    setMutating(true);
    try {
      const result = await freeCashApi.revokeFreeCashForUser(email, freeCashId);
      toast.success(`Free Cash revoked for ${email}`);
      return { success: true, revokedCount: result?.revokedCount };
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to revoke Free Cash for this customer'));
      return { success: false };
    } finally {
      setMutating(false);
    }
  };

  const revokeForAllUsers = async (freeCashId) => {
    setMutating(true);
    try {
      const result = await freeCashApi.revokeFreeCashForAllUsers(freeCashId);
      toast.success('Free Cash revoked for all users successfully');
      return { success: true, revokedCount: result?.revokedCount };
    } catch (err) {
      toast.error(err.message || 'Failed to revoke Free Cash for all users');
      return { success: false };
    } finally {
      setMutating(false);
    }
  };

  // --- Bulk multi-select actions (checkbox column) --------------------------
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} Free Cash campaign(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      const firstFailure = (data?.results || []).find((r) => !r.isSuccess);
      toast.error(firstFailure?.message || `Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected campaign(s)`);
    } else {
      toast.warning(`${successCount} campaign(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (freeCashIds, status, notifyCustomers = false) => {
    if (!freeCashIds || freeCashIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await freeCashApi.bulkSetFreeCashStatus(freeCashIds, status, notifyCustomers);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      await fetchFreeCash();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update Free Cash status');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveFreeCash = async (freeCashIds) => {
    if (!freeCashIds || freeCashIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await freeCashApi.bulkDeleteFreeCash(freeCashIds);
      describeBulkOutcome(data, 'deleted');
      await fetchFreeCash();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete Free Cash campaigns');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    freeCashList,
    loading,
    error,
    mutating,
    refetch: fetchFreeCash,
    fetchFreeCashById,
    createFreeCash,
    editFreeCash,
    removeFreeCash,
    toggleStatus,
    revokeForUser,
    revokeForAllUsers,
    bulkToggleStatus,
    bulkRemoveFreeCash,
  };
};

export default useFreeCash;
