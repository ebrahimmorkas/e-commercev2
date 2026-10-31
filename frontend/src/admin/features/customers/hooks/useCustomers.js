import { useCallback, useEffect, useRef, useState } from 'react';
import * as customerApi from '../api/customerApi';
import { useToast } from '../../../../components/common/Toast';
import {
  DEFAULT_CUSTOMER_SORT,
  DEFAULT_CUSTOMER_PAGE_SIZE,
  EMPTY_CUSTOMER_FILTERS,
  countActiveFilters,
  toCustomerFilterParams,
} from '../utils/customerListFilters';

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Owns the customers list state for the admin page: fetching, and the
 * update/change-password/delete/toggle mutations, each surfacing errors via
 * toast rather than throwing, so callers can just check the boolean result.
 * There is no create here - that's the separate Add User module
 * (admin/features/addUser).
 *
 * The list is paginated, searched, filtered and sorted on the server (GET
 * /users/list-customers-admin), same as admin/features/products/hooks/useProducts.js,
 * so only one page of customers is ever in memory. While another page or
 * search loads, the previous rows stay on screen (`loading` is true).
 */
export const useCustomers = () => {
  // What the admin typed (instant) vs. what the server is asked for (debounced).
  const [searchText, setSearchTextState] = useState('');
  const [params, setParams] = useState({
    page: 1,
    q: '',
    sort: DEFAULT_CUSTOMER_SORT,
    filters: EMPTY_CUSTOMER_FILTERS,
    limit: DEFAULT_CUSTOMER_PAGE_SIZE,
  });
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${JSON.stringify(params)}|${reloadToken}`;
  const [result, setResult] = useState({ key: null, customers: [], pagination: null, totalCustomers: 0, error: '' });
  const [mutating, setMutating] = useState(false);
  const searchTimerRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    customerApi
      .listCustomersAdmin({
        page: params.page,
        limit: params.limit,
        q: params.q,
        sort: params.sort,
        ...toCustomerFilterParams(params.filters),
      })
      .then((data) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          customers: Array.isArray(data?.users) ? data.users : [],
          pagination: data?.pagination || null,
          totalCustomers: data?.totalCustomers ?? 0,
          error: '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setResult((prev) => ({ ...prev, key: requestKey, customers: [], pagination: null, error: err.message || 'Failed to load customers' }));
        }
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

  // A new sort, filter or page size always starts again from page 1.
  const setSort = useCallback((sort) => setParams((prev) => ({ ...prev, page: 1, sort: sort || DEFAULT_CUSTOMER_SORT })), []);
  const setFilters = useCallback((filters) => setParams((prev) => ({ ...prev, page: 1, filters: { ...EMPTY_CUSTOMER_FILTERS, ...filters } })), []);
  const clearFilters = useCallback(() => setParams((prev) => ({ ...prev, page: 1, filters: EMPTY_CUSTOMER_FILTERS })), []);
  const setPage = useCallback((page) => setParams((prev) => ({ ...prev, page })), []);
  const setPageSize = useCallback((limit) => setParams((prev) => ({ ...prev, page: 1, limit: Number(limit) || DEFAULT_CUSTOMER_PAGE_SIZE })), []);

  // Reloads the current page. A page emptied by a delete steps back one page.
  const fetchCustomers = useCallback(() => setReloadToken((token) => token + 1), []);
  const refetchAfterRemoving = (removedCount) => {
    const remaining = result.customers.length - removedCount;
    if (remaining <= 0 && params.page > 1) setPage(params.page - 1);
    else fetchCustomers();
  };

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
      fetchCustomers();
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
      refetchAfterRemoving(1);
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
      fetchCustomers();
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
      fetchCustomers();
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
      refetchAfterRemoving(data?.successCount ?? 0);
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete customers');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    customers: result.customers,
    pagination: result.pagination,
    // Every customer of the store, ignoring search and filters.
    totalCustomers: result.totalCustomers,
    page: params.page,
    setPage,
    pageSize: params.limit,
    setPageSize,
    searchText,
    setSearchText,
    sort: params.sort,
    setSort,
    filters: params.filters,
    setFilters,
    clearFilters,
    activeFilterCount: countActiveFilters(params.filters),
    loading,
    initialLoading: loading && result.key === null,
    error: result.error,
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
