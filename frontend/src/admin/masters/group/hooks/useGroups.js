import { useCallback, useEffect, useState } from 'react';
import * as groupApi from '../api/groupApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the groups list state for the admin page: fetching, and the
 * create/update/delete/activate/deactivate mutations, each surfacing errors
 * via toast rather than throwing, so callers can just check the boolean result.
 */
export const useGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await groupApi.getAllGroups();
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (err) {
      setError(err.message || 'Failed to load groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Appends a "(8/10 rows matched, 2 failed)" style suffix to the success
  // toast when the mutation resolved members from an uploaded excel file.
  const excelSummary = (excelReport) => {
    if (!excelReport || !excelReport.totalRows) return '';
    const { successCount, failedCount, totalRows } = excelReport;
    return failedCount > 0
      ? ` (${successCount}/${totalRows} rows matched, ${failedCount} failed)`
      : ` (${successCount}/${totalRows} rows matched)`;
  };

  const createGroup = async (payload, excelFile) => {
    setMutating(true);
    try {
      const result = await groupApi.addGroup(payload, excelFile);
      toast.success(`Group created successfully${excelSummary(result?.excelReport)}`);
      await fetchGroups();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to create group');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editGroup = async (groupId, payload, excelFile) => {
    setMutating(true);
    try {
      const result = await groupApi.updateGroup({ id: groupId, ...payload }, excelFile);
      toast.success(`Group updated successfully${excelSummary(result?.excelReport)}`);
      await fetchGroups();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update group');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeGroup = async (groupId) => {
    setMutating(true);
    try {
      await groupApi.deleteGroup(groupId);
      toast.success('Group deleted successfully');
      await fetchGroups();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete group');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = async (group) => {
    setMutating(true);
    try {
      if (group.status === 'A') {
        await groupApi.deactivateGroup(group._id);
        toast.success('Group deactivated successfully');
      } else {
        await groupApi.activateGroup(group._id);
        toast.success('Group activated successfully');
      }
      await fetchGroups();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update group status');
      return false;
    } finally {
      setMutating(false);
    }
  };

  return {
    groups,
    loading,
    error,
    mutating,
    refetch: fetchGroups,
    createGroup,
    editGroup,
    removeGroup,
    toggleStatus,
  };
};

export default useGroups;
