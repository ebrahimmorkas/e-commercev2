import { useCallback, useEffect, useState } from 'react';
import * as customerApi from '../api/customerApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the customers list state for the admin page: fetching, and the
 * update/change-password/delete/toggle mutations, each surfacing errors via
 * toast rather than throwing, so callers can just check the boolean result.
 * Mirrors admin/masters/brand/hooks/useBrands.js. There is no create here -
 * that's the separate Add User module (admin/features/addUser).
 */
export const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await customerApi.getAllUsersAdmin();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchCustomerById = async (userId) => {
    try {
      return await customerApi.getUserById(userId);
    } catch (err) {
      toast.error(err.message || 'Failed to load customer');
      return null;
    }
  };

  const editCustomer = async (userId, payload) => {
    setMutating(true);
    try {
      await customerApi.updateUser(userId, payload);
      toast.success('Customer updated successfully');
      await fetchCustomers();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update customer');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const changeCustomerPassword = async (userId, newPassword) => {
    setMutating(true);
    try {
      await customerApi.changePassword(userId, newPassword);
      toast.success('Password changed successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeCustomer = async (userId) => {
    setMutating(true);
    try {
      await customerApi.deleteUser(userId);
      toast.success('Customer deleted successfully');
      await fetchCustomers();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete customer');
      return false;
    } finally {
      setMutating(false);
    }
  };

  // No dedicated single-record status endpoint exists for customers (see
  // backend/services/userService.js) - reuses bulk-status with a one-element
  // array instead, same as the bulk helpers below but with its own toast
  // wording rather than the "N customer(s)" bulk phrasing.
  const toggleStatus = async (customer) => {
    const nextStatus = customer.status === 'A' ? 'I' : 'A';
    setMutating(true);
    try {
      await customerApi.bulkSetUserStatus([customer._id], nextStatus);
      toast.success(`Customer ${nextStatus === 'A' ? 'activated' : 'deactivated'} successfully`);
      await fetchCustomers();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update customer status');
      return false;
    } finally {
      setMutating(false);
    }
  };

  // Surfaces a { results, successCount, failureCount } bulk response as a
  // single toast - success if everything went through, a warning naming the
  // partial count when some items failed, or an error if none did.
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} customer(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected customer(s)`);
    } else {
      toast.warning(`${successCount} customer(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (userIds, status) => {
    if (!userIds || userIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await customerApi.bulkSetUserStatus(userIds, status);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      await fetchCustomers();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update customer status');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveCustomers = async (userIds) => {
    if (!userIds || userIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await customerApi.bulkDeleteUsers(userIds);
      describeBulkOutcome(data, 'deleted');
      await fetchCustomers();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete customers');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    customers,
    loading,
    error,
    mutating,
    refetch: fetchCustomers,
    fetchCustomerById,
    editCustomer,
    changeCustomerPassword,
    removeCustomer,
    toggleStatus,
    bulkToggleStatus,
    bulkRemoveCustomers,
  };
};

export default useCustomers;
