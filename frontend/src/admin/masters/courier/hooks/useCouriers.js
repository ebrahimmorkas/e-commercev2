import { useCallback, useEffect, useState } from 'react';
import * as courierApi from '../api/courierApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the couriers list state for the admin page: fetching, and the
 * create/update/delete/toggle mutations, each surfacing errors via toast
 * rather than throwing, so callers can just check the boolean result.
 */
export const useCouriers = () => {
  const [couriers, setCouriers] = useState([]);
  const [numberOfCouriersAllowed, setNumberOfCouriersAllowed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const applyCouriers = useCallback((data) => {
    setCouriers(Array.isArray(data?.couriers) ? data.couriers : []);
    setNumberOfCouriersAllowed(data?.numberOfCouriersAllowed ?? null);
  }, []);

  const applyLoadError = useCallback((err) => {
    setError(err.message || 'Failed to load couriers');
    setCouriers([]);
  }, []);

  // Refetch after a mutation (the first load is the effect below).
  const fetchCouriers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyCouriers(await courierApi.getAllCouriersAdmin());
    } catch (err) {
      applyLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [applyCouriers, applyLoadError]);

  // First load: state is only set once the request settles (loading starts true).
  useEffect(() => {
    let cancelled = false;
    courierApi
      .getAllCouriersAdmin()
      .then((data) => {
        if (!cancelled) applyCouriers(data);
      })
      .catch((err) => {
        if (!cancelled) applyLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyCouriers, applyLoadError]);

  // Shared shape for the single-item mutations: run, toast, refetch.
  const runMutation = async (action, successMessage, failureMessage) => {
    setMutating(true);
    try {
      await action();
      toast.success(successMessage);
      await fetchCouriers();
      return true;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return false;
    } finally {
      setMutating(false);
    }
  };

  const createCourier = (payload) =>
    runMutation(() => courierApi.addCourier(payload), 'Courier added successfully', 'Failed to add courier');

  const editCourier = (courierId, payload) =>
    runMutation(
      () => courierApi.updateCourier({ courierId, ...payload }),
      'Courier updated successfully',
      'Failed to update courier'
    );

  const removeCourier = (courierId) =>
    runMutation(() => courierApi.deleteCourier(courierId), 'Courier deleted successfully', 'Failed to delete courier');

  const toggleStatus = (courier) => editCourier(courier._id, { status: courier.status === 'A' ? 'I' : 'A' });

  // Surfaces a { results, successCount, failureCount } bulk response as a
  // single toast.
  const describeBulkOutcome = (data, pastTenseVerb, failureVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} courier(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${failureVerb} the selected courier(s)`);
    } else {
      toast.warning(`${successCount} courier(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const runBulk = async (action, pastTenseVerb, failureVerb, failureMessage) => {
    setMutating(true);
    try {
      const data = await action();
      describeBulkOutcome(data, pastTenseVerb, failureVerb);
      await fetchCouriers();
      return data;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkToggleStatus = (courierIds, status) => {
    if (!courierIds || courierIds.length === 0) return null;
    return runBulk(
      () => courierApi.bulkSetCourierStatus(courierIds, status),
      status === 'A' ? 'activated' : 'deactivated',
      'update',
      'Failed to update courier status'
    );
  };

  const bulkRemoveCouriers = (courierIds) => {
    if (!courierIds || courierIds.length === 0) return null;
    return runBulk(() => courierApi.bulkDeleteCouriers(courierIds), 'deleted', 'delete', 'Failed to delete couriers');
  };

  return {
    couriers,
    numberOfCouriersAllowed,
    loading,
    error,
    mutating,
    refetch: fetchCouriers,
    createCourier,
    editCourier,
    removeCourier,
    toggleStatus,
    bulkToggleStatus,
    bulkRemoveCouriers,
  };
};

export default useCouriers;
