import { useCallback, useEffect, useState } from 'react';
import * as freeCashApi from '../api/freeCashApi';
import { useToast } from '../../../../components/common/Toast';
import { mapApiFreeCashToDraft, buildSubmitFields, needsExcelFor } from '../utils/freeCashDraft';

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
      toast.error(err.message || 'Failed to create Free Cash campaign');
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  const editFreeCash = async (freeCashId, fields, excelFile) => {
    setMutating(true);
    try {
      const result = await freeCashApi.updateFreeCash(freeCashId, fields, excelFile);
      toast.success('Free Cash campaign updated successfully');
      await fetchFreeCash();
      return { success: true, excelReports: result?.excelReports };
    } catch (err) {
      toast.error(err.message || 'Failed to update Free Cash campaign');
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

  /**
   * updateFreeCash always re-validates and re-resolves the full targeting
   * payload (see freeCashService.updateFreeCash), so a status flip can't be
   * a lightweight PATCH - it resends every field, reconstructed from the
   * list row (which already carries the full doc). That's only possible when
   * giveFreeCashTo doesn't depend on a re-uploaded excel file; otherwise the
   * caller is directed to the edit form instead. Mirrors useDiscounts.toggleStatus.
   */
  const toggleStatus = async (freeCash) => {
    if (needsExcelFor(freeCash.giveFreeCashTo)) {
      toast.error('This campaign\'s targeting was set via an excel upload - open Edit and re-upload the file to change its status.');
      return false;
    }
    const draft = mapApiFreeCashToDraft(freeCash);
    draft.status = freeCash.status === 'A' ? 'I' : 'A';
    const fields = buildSubmitFields(draft, { includeStatus: true });
    const result = await editFreeCash(freeCash._id, fields, null);
    return result.success;
  };

  const revokeForUser = async (userId, freeCashId) => {
    setMutating(true);
    try {
      const result = await freeCashApi.revokeFreeCashForUser(userId, freeCashId);
      toast.success('Free Cash revoked for the user successfully');
      return { success: true, revokedCount: result?.revokedCount };
    } catch (err) {
      toast.error(err.message || 'Failed to revoke Free Cash for this user');
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
  // Unlike the single-row toggleStatus above, the bulk status endpoint is a
  // dedicated, minimal status flip on the backend (freeCashService's
  // setFreeCashStatusForBulk) - it never re-validates/re-resolves the full
  // targeting payload the way updateFreeCash does, so the "targeting was set
  // via excel, re-upload to change status" restriction doesn't apply here.
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} Free Cash campaign(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected campaign(s)`);
    } else {
      toast.warning(`${successCount} campaign(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (freeCashIds, status) => {
    if (!freeCashIds || freeCashIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await freeCashApi.bulkSetFreeCashStatus(freeCashIds, status);
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
